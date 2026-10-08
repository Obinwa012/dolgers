'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AliExpressClient } from '@/core/aliexpress/client.ts';
import { ClaudeModel, DEFAULT_MODELS } from '@/core/ai/claude.ts';
import { MENS_CLOTHING, US_FEEDS } from '@/core/stages.ts';
import { CONFIG_VERSION, DEFAULT_CONFIG, mergeConfig, type VettingConfig } from '@/core/vetting/config.ts';
import { adminOrThrow } from '../auth.ts';
import { siteUrl } from '../context.ts';
import { db, repo } from '../firebase.ts';
import { fail, type Result } from './result.ts';

// ---------------------------------------------------------------- AliExpress

export async function saveAliExpressKeys(appKey: string, appSecret: string): Promise<Result> {
  try {
    await adminOrThrow();
    const patch: Record<string, string> = {};
    if (appKey.trim()) patch.aeAppKey = appKey.trim();
    if (appSecret.trim()) patch.aeAppSecret = appSecret.trim();
    if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to save.' };
    await repo().saveSecrets(patch);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** For pasting tokens obtained elsewhere (the normal route is Connect AliExpress). */
export async function saveAliExpressTokens(accessToken: string, refreshToken: string, expiresAt: string): Promise<Result> {
  try {
    await adminOrThrow();
    const at = accessToken.trim();
    if (!at) return { ok: false, error: 'Paste an access token.' };
    const exp = Number(expiresAt.trim());
    await repo().saveSecrets({
      aeAccessToken: at,
      aeRefreshToken: refreshToken.trim() || null,
      // Without an expiry, assume the usual 24 hours from now.
      aeExpiresAt: Number.isFinite(exp) && exp > Date.now() ? exp : Date.now() + 24 * 3600e3,
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Starts the AliExpress authorization: redirects to AliExpress, which returns to /api/auth/ae/callback. */
export async function connectAliExpress(): Promise<void> {
  await adminOrThrow();
  const s = await repo().secrets();
  if (!s.aeAppKey || !s.aeAppSecret) redirect('/settings?tab=aliexpress&error=' + encodeURIComponent('Save the app key and secret first.'));
  const state = randomBytes(16).toString('hex');
  await db().collection('oauth_states').doc(state).set({ createdAt: Date.now() });
  (await cookies()).set('ae_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  const client = new AliExpressClient({ appKey: s.aeAppKey!, appSecret: s.aeAppSecret!, tokens: repo().tokenStore() });
  redirect(client.authorizeUrl(`${siteUrl()}/api/auth/ae/callback`, state));
}

/** Makes one real API call (refreshing the token first if it is close to expiry). */
export async function testAliExpress(): Promise<Result<{ message: string }>> {
  try {
    await adminOrThrow();
    const s = await repo().secrets();
    if (!s.aeAppKey || !s.aeAppSecret) return { ok: false, error: 'Save the app key and secret first.' };
    const client = new AliExpressClient({ appKey: s.aeAppKey, appSecret: s.aeAppSecret, tokens: repo().tokenStore(), minIntervalMs: 0 });
    const page = await client.feedPage(US_FEEDS[0]!, { categoryId: MENS_CLOTHING, page: 1, pageSize: 5 });
    return { ok: true, message: `Connected. The US feed returned ${page.items.length} men's items (about ${page.total ?? '?'} in total).` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Claude

export async function saveClaude(apiKey: string, fast: string, careful: string): Promise<Result> {
  try {
    await adminOrThrow();
    if (apiKey.trim()) {
      if (!apiKey.trim().startsWith('sk-ant-')) return { ok: false, error: 'That doesn’t look like a Claude API key (they start with sk-ant-).' };
      await repo().saveSecrets({ anthropicApiKey: apiKey.trim() });
    }
    await repo().saveSettings({ aiModels: { fast: fast.trim() || DEFAULT_MODELS.fast, careful: careful.trim() || DEFAULT_MODELS.careful } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function testClaude(): Promise<Result<{ message: string }>> {
  try {
    await adminOrThrow();
    const [s, settings] = await Promise.all([repo().secrets(), repo().settings()]);
    if (!s.anthropicApiKey) return { ok: false, error: 'Save a Claude API key first.' };
    const models = { ...DEFAULT_MODELS, ...(settings.aiModels ?? {}) };
    const m = new ClaudeModel(s.anthropicApiKey);
    const seen = new Set<string>();
    for (const model of [models.fast, models.careful]) {
      if (seen.has(model)) continue;
      seen.add(model);
      const out = await m.generate({
        model,
        system: 'Reply with the JSON requested.',
        parts: [{ type: 'text', text: 'Return ok=true.' }],
        schema: z.strictObject({ ok: z.boolean() }),
        maxTokens: 50,
      });
      if (!out.ok) return { ok: false, error: `${model} answered unexpectedly.` };
    }
    return { ok: true, message: `Working: ${[...seen].join(' and ')} answered.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- DOLGERS

const Num = z.coerce.number().finite();
const Share = Num.min(0).max(1);
const ConfigInput = z.object({
  minStoreRating: Num.min(0).max(5),
  strongSellerRating: Num.min(0).max(5),
  importMinBuyers: Num.int().min(1),
  probationMinBuyers: Num.int().min(1),
  importMinTextReviews: Num.int().min(0),
  minRecentReviews: Num.int().min(0),
  recentDays: Num.int().min(1),
  maxProblemUpperBound: Share,
  probationMaxUpperBound: Share,
  systemicRejectBuyers: Num.int().min(1),
  systemicRejectShare: Share,
  recentProblemRatio: Num.min(1),
  fakeReviews: z.object({ burstShare: Share, duplicateReviews: Num.int().min(2), noText5StarShare: Share }),
  minUsVariantShare: Share,
  maxChinaLogisticsShare: Share,
  maxDeliveryDays: Num.int().min(1),
  suspiciousShippingMaxFeeCents: Num.int().min(0),
  suspiciousShippingMaxItemCents: Num.int().min(0),
  recheckAfterDays: Num.int().min(1),
  maxRefundRate: Share,
  refundRateMinOrders: Num.int().min(1),
  pricing: z.object({
    profitCents: Num.int().min(0),
    returnReserveRate: Share,
    returnShippingCents: Num.int().min(0),
    paymentFeeRate: Num.min(0).max(0.5),
    paymentFeeFixedCents: Num.int().min(0),
    minProfitCents: Num.int().min(0),
    freeShipping: z.boolean(),
  }),
  ipBlocklist: z.array(z.string()),
});

export async function saveDolgers(input: {
  config: VettingConfig;
  feeds: string[];
  importPages: number;
}): Promise<Result> {
  try {
    await adminOrThrow();
    const parsed = ConfigInput.safeParse(input.config);
    if (!parsed.success) return { ok: false, error: `Check the values: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}` };
    const config = mergeConfig({ ...parsed.data, version: CONFIG_VERSION });
    config.ipBlocklist = [...new Set(config.ipBlocklist.map((w) => w.trim().toLowerCase()).filter(Boolean))];
    if (config.probationMinBuyers > config.importMinBuyers) {
      return { ok: false, error: 'Probation needs fewer buyers than a full import.' };
    }
    if (config.pricing.minProfitCents > config.pricing.profitCents) {
      return { ok: false, error: 'The minimum profit can’t be more than the profit prices are set from.' };
    }
    const feeds = [...new Set(input.feeds.map((f) => f.trim()).filter(Boolean))];
    await repo().saveSettings({
      vetting: config,
      feeds: feeds.length ? feeds : US_FEEDS,
      importPages: Math.max(1, Math.min(50, Math.round(input.importPages) || 5)),
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetDolgers(): Promise<Result> {
  try {
    await adminOrThrow();
    await repo().saveSettings({ vetting: DEFAULT_CONFIG, feeds: US_FEEDS, importPages: 5 });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

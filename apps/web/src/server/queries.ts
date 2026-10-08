import 'server-only';
import type { CandidateStatus, ProductStatus, SecretsDoc } from '@/core/firestore/model.ts';
import { db, repo } from './firebase.ts';

export const PRODUCT_STATUSES: ProductStatus[] = ['live', 'pending_review', 'paused', 'retired'];
export const CANDIDATE_STATUSES: CandidateStatus[] = ['new', 'vetting', 'held', 'published', 'insufficient_data', 'screened_out', 'rejected', 'error'];

async function countWhere(col: string, field: string, value: unknown) {
  return (await db().collection(col).where(field, '==', value).count().get()).data().count;
}

export async function productCounts(): Promise<Record<ProductStatus, number>> {
  const n = await Promise.all(PRODUCT_STATUSES.map((s) => countWhere('products', 'status', s)));
  return Object.fromEntries(PRODUCT_STATUSES.map((s, i) => [s, n[i]!])) as Record<ProductStatus, number>;
}

export async function candidateCounts(): Promise<Record<CandidateStatus, number>> {
  const n = await Promise.all(CANDIDATE_STATUSES.map((s) => countWhere('candidates', 'status', s)));
  return Object.fromEntries(CANDIDATE_STATUSES.map((s, i) => [s, n[i]!])) as Record<CandidateStatus, number>;
}

export async function blockedSellerCount() {
  return countWhere('sellers', 'blocked', true);
}

export interface SetupStatus {
  aeKeys: boolean;
  aeAppKey: string | null;
  aeConnected: boolean;
  aeExpiresAt: number | null;
  aeRefreshable: boolean;
  aeRefreshExpiresAt: number | null;
  claudeKey: boolean;
  claudeKeyHint: string | null;
  secretsUpdatedAt: number | null;
}

/** What Settings has, without ever sending a secret to the browser. */
export async function setupStatus(): Promise<SetupStatus> {
  const s: SecretsDoc = await repo().secrets();
  const now = Date.now();
  return {
    aeKeys: !!(s.aeAppKey && s.aeAppSecret),
    aeAppKey: s.aeAppKey ?? null,
    aeConnected: !!s.aeAccessToken && ((s.aeExpiresAt ?? 0) > now || !!s.aeRefreshToken),
    aeExpiresAt: s.aeExpiresAt ?? null,
    aeRefreshable: !!s.aeRefreshToken,
    aeRefreshExpiresAt: s.aeRefreshExpiresAt ?? null,
    claudeKey: !!s.anthropicApiKey,
    claudeKeyHint: s.anthropicApiKey ? `…${s.anthropicApiKey.slice(-4)}` : null,
    secretsUpdatedAt: s.updatedAt ?? null,
  };
}

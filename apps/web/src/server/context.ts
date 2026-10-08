import 'server-only';
import { AliExpressClient } from '@/core/aliexpress/client.ts';
import { ClaudeModel, DEFAULT_MODELS } from '@/core/ai/claude.ts';
import type { PipelineContext } from '@/core/stages.ts';
import { repo } from './firebase.ts';

/** Everything a job step needs, built from Settings (config/secrets and config/pipeline). */
export async function pipelineContext(): Promise<PipelineContext> {
  const r = repo();
  const [secrets, settings, config] = await Promise.all([r.secrets(), r.settings(), r.loadConfig()]);
  if (!secrets.aeAppKey || !secrets.aeAppSecret) {
    throw new Error('AliExpress app key and secret are not set. Add them in Settings → AliExpress.');
  }
  const ae = new AliExpressClient({
    appKey: secrets.aeAppKey,
    appSecret: secrets.aeAppSecret,
    tokens: r.tokenStore(),
    log: (m) => console.log(m),
  });
  let model: ClaudeModel | null = null;
  return {
    ae,
    repo: r,
    model: () => (model ??= new ClaudeModel(secrets.anthropicApiKey)),
    models: { ...DEFAULT_MODELS, ...stripEmpty(settings.aiModels) },
    config,
    log: (m) => console.log(m),
  };
}

function stripEmpty<T extends object>(o: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}

/** The public address of this site, for the AliExpress OAuth redirect. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

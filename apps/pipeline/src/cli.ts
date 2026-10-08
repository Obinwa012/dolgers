#!/usr/bin/env node
/**
 * DOLGERS sourcing pipeline.
 *
 *   pipeline auth url --redirect <uri>       print the AliExpress authorize link
 *   pipeline auth exchange <code>            store tokens from the authorize redirect
 *   pipeline auth set --access <t> [--refresh <t>] [--expires <ms>]
 *   pipeline auth status
 *   pipeline import --department men|women [--pages 5] [--feeds a,b]
 *   pipeline run [--limit 25]                screen → vet → list → publish due candidates
 *   pipeline vet <productId> [--department men|women]
 *   pipeline monitor                         re-check price, stock and shipping of listed products
 *   pipeline report
 *
 * Global flags: --dry-run (memory store, results written to ./out), --emulator (Firestore emulator).
 * Env: AE_APP_KEY, AE_APP_SECRET, ANTHROPIC_API_KEY, GCLOUD_PROJECT; Firestore credentials via
 * Application Default Credentials or FIREBASE_SERVICE_ACCOUNT (JSON).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  AeApiError,
  AliExpressClient,
  ClaudeModel,
  type CandidateDoc,
  DEFAULT_MODELS,
  DEPARTMENTS,
  type Department,
  FirestoreRepo,
  importFeeds,
  MemoryRepo,
  monitorProduct,
  type PipelineContext,
  processCandidate,
  type Repo,
} from '@dolgers/core';

// Load apps/pipeline/.env when present (Node 22+). Real deployments use Secret Manager instead.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  /* no .env file */
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    emulator: { type: 'boolean', default: false },
    department: { type: 'string', default: 'men' },
    pages: { type: 'string', default: '5' },
    feeds: { type: 'string' },
    limit: { type: 'string', default: '25' },
    redirect: { type: 'string' },
    access: { type: 'string' },
    refresh: { type: 'string' },
    expires: { type: 'string' },
  },
});

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. See apps/pipeline/.env.example.`);
  return v;
}

async function main() {
  if (values.emulator) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  const repo: Repo = values['dry-run'] ? new MemoryRepo() : new FirestoreRepo();
  if (repo instanceof MemoryRepo && process.env.AE_ACCESS_TOKEN) {
    // Dry runs have no database to keep tokens in; take them from the environment.
    repo.tokens = {
      accessToken: process.env.AE_ACCESS_TOKEN,
      refreshToken: process.env.AE_REFRESH_TOKEN ?? null,
      expiresAt: Number(process.env.AE_EXPIRES_AT ?? Date.now() + 23 * 3600e3),
      refreshExpiresAt: null,
    };
  }
  const [cmd, sub, arg] = positionals;
  const ae = () => new AliExpressClient({ appKey: env('AE_APP_KEY'), appSecret: env('AE_APP_SECRET'), tokens: repo.tokenStore(), log });
  const department = (values.department === 'women' ? 'women' : 'men') as Department;

  if (cmd === 'auth') {
    const client = ae();
    if (sub === 'url') {
      if (!values.redirect) throw new Error('--redirect is required (the callback URL registered for your AliExpress app)');
      console.log(client.authorizeUrl(values.redirect, randomUUID()));
      console.log('\nOpen it, approve, then copy the `code` from the address you land on and run:\n  pipeline auth exchange <code>');
    } else if (sub === 'exchange') {
      if (!arg) throw new Error('Usage: pipeline auth exchange <code>');
      const t = await client.exchangeCode(arg);
      console.log(`Stored. Access token valid until ${new Date(t.expiresAt).toISOString()}; refresh token ${t.refreshToken ? 'stored' : 'NOT returned'}.`);
    } else if (sub === 'set') {
      if (!values.access) throw new Error('--access is required');
      await repo.tokenStore().save({
        accessToken: values.access,
        refreshToken: values.refresh ?? null,
        expiresAt: Number(values.expires ?? Date.now() + 23 * 3600e3),
        refreshExpiresAt: null,
      });
      console.log('Stored.');
    } else {
      const t = await repo.tokenStore().load();
      console.log(t ? `Access token expires ${new Date(t.expiresAt).toISOString()}; refresh token ${t.refreshToken ? 'present' : 'missing (tokens cannot renew themselves)'}` : 'No token stored.');
    }
    return;
  }

  // The AI client is created only when a command actually needs it (run/vet).
  let model: ClaudeModel | null = null;
  const ctx = (): PipelineContext => ({
    ae: ae(),
    repo,
    get model() {
      return (model ??= new ClaudeModel(env('ANTHROPIC_API_KEY')));
    },
    models: DEFAULT_MODELS,
    config: undefined as never,
    log,
  });

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${cmd}`;
  await repo.startRun({ id: runId, command: cmd ?? '', args: values, startedAt: Date.now(), finishedAt: null, counts: {}, errors: [] });
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  try {
    const c: PipelineContext = Object.assign(ctx(), { config: await repo.loadConfig() });
    if (cmd === 'import') {
      const r = await importFeeds(c, { department, pages: Number(values.pages), feeds: values.feeds?.split(',') });
      Object.assign(counts, r);
      log(`Imported ${r.seen} candidates (${r.added} new, ${r.updated} already known)`);
    } else if (cmd === 'run' || cmd === 'vet') {
      if (cmd === 'vet' && !sub) throw new Error('Usage: pipeline vet <productId> [--department men|women]');
      if (cmd === 'run' || cmd === 'vet') void c.model; // fail fast if ANTHROPIC_API_KEY is missing
      let list: CandidateDoc[];
      if (cmd === 'vet') {
        const manual: CandidateDoc = {
          subId: sub!, mainId: null, feeds: ['manual'], title: '', department, categoryId: DEPARTMENTS[department],
          subcategoryName: null, shopId: null, recentSales: 0, feedPriceCents: null, status: 'new', reasons: [],
          nextCheckAt: null, attempts: 0, createdAt: Date.now(), updatedAt: Date.now(),
        };
        await repo.upsertCandidates([manual]);
        list = [manual];
      } else {
        list = await repo.dueCandidates(Number(values.limit), Date.now());
      }
      log(`${list.length} candidate(s) to process`);
      for (const cand of list) {
        try {
          const r = await processCandidate(c, cand);
          bump(r.outcome);
          log(`${cand.subId} → ${r.outcome}${r.productId ? ` (${r.productId})` : ''}: ${r.reasons.slice(0, 3).join(' | ')}`);
        } catch (e) {
          bump('error');
          const msg = `${cand.subId}: ${(e as Error).message}`;
          errors.push(msg);
          log(`ERROR ${msg}`);
          await repo.updateCandidate(cand.subId, { status: 'error', reasons: [(e as Error).message], attempts: cand.attempts + 1, nextCheckAt: Date.now() + 86400e3 });
          // An auth problem will fail every remaining candidate the same way: stop the run.
          if (e instanceof AeApiError && /Token|Auth|Signature|AppKey/i.test(e.code)) {
            log('Stopping: AliExpress authorization problem. Run `pipeline auth status`.');
            break;
          }
        }
      }
    } else if (cmd === 'monitor') {
      const products = await repo.listProducts(['live', 'pending_review', 'paused']);
      log(`Checking ${products.length} product(s)`);
      for (const p of products) {
        try {
          const r = await monitorProduct(c, p);
          bump(r.changed ? 'changed' : 'unchanged');
          if (r.notes.length) log(`${p.id}: ${r.notes.join(' | ')}`);
        } catch (e) {
          bump('error');
          errors.push(`${p.id}: ${(e as Error).message}`);
        }
      }
    } else if (cmd === 'report') {
      for (const s of ['live', 'pending_review', 'paused', 'retired'] as const) counts[s] = (await repo.listProducts([s])).length;
      console.table(counts);
    } else {
      console.log('Commands: auth, import, run, vet, monitor, report. See the header of apps/pipeline/src/cli.ts.');
    }
  } finally {
    await repo.finishRun(runId, { finishedAt: Date.now(), counts, errors });
    if (repo instanceof MemoryRepo) {
      mkdirSync('out', { recursive: true });
      writeFileSync(`out/${runId}.json`, JSON.stringify(repo.dump(), null, 2));
      log(`Dry run: results in out/${runId}.json`);
    }
    if (Object.keys(counts).length && cmd !== 'report') log(`Done: ${JSON.stringify(counts)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

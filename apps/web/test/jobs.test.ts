import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AliExpressClient } from '../src/core/aliexpress/client.ts';
import { MemoryRepo } from '../src/core/firestore/repo.ts';
import { AUTH_ERROR, newJob, stepJob } from '../src/core/jobs.ts';
import type { PipelineContext } from '../src/core/stages.ts';
import { DEFAULT_CONFIG } from '../src/core/vetting/config.ts';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

function ctx(repo: MemoryRepo, fetchImpl: typeof fetch): PipelineContext {
  repo.secretsDoc = { aeAccessToken: 't', aeRefreshToken: 'r', aeExpiresAt: Date.now() + 3600e3 };
  return {
    ae: new AliExpressClient({ appKey: 'k', appSecret: 's', tokens: repo.tokenStore(), fetchImpl, sleep: async () => {}, minIntervalMs: 0 }),
    repo,
    model: () => {
      throw new Error('no AI in this test');
    },
    models: { fast: 'f', careful: 'c' },
    config: DEFAULT_CONFIG,
    log: () => {},
    sleep: async () => {},
  };
}

const feedFetch = (async (_u: string | URL, init?: RequestInit) => {
  const body = new URLSearchParams(String(init?.body ?? ''));
  if (body.get('method') === 'aliexpress.ds.recommend.feed.get') {
    const page = fx('feed_page.json');
    // Two pages per feed, then the feed says it's finished.
    page.aliexpress_ds_recommend_feed_get_response.result.is_finished = body.get('page_no') === '2';
    return new Response(JSON.stringify(page));
  }
  if (body.get('method') === 'aliexpress.ds.product.get') return new Response(JSON.stringify(fx('product_unavailable.json')));
  throw new Error('unexpected');
}) as typeof fetch;

async function runToEnd(c: PipelineContext, id: string) {
  for (let i = 0; i < 50; i++) {
    const r = await stepJob(c, id);
    if (r.job.status !== 'running') return r.job;
  }
  throw new Error('job did not finish');
}

describe('import job', () => {
  it('walks every feed page by page and queues men’s items once', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    const job = newJob('import', { pages: 5, feeds: ['A', 'B'] }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(c, job.id);
    expect(done.status).toBe('done');
    expect(done.progress).toEqual({ done: 2, total: 2 });
    // The fixture page holds 5 items; the same 5 come back from every page and feed.
    expect(repo.candidates.size).toBe(5);
    expect([...repo.candidates.values()].every((x) => x.department === 'men' && x.feeds.length === 2)).toBe(true);
    expect(done.log.at(-1)?.text).toMatch(/Import finished/);
  });
});

describe('vet job', () => {
  it('processes up to the limit, logging each outcome', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    const imp = newJob('import', { pages: 1, feeds: ['A'] }, 'admin');
    await repo.createJob(imp);
    await runToEnd(c, imp.id);

    const job = newJob('vet', { limit: 3 }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(c, job.id);
    expect(done.status).toBe('done');
    expect(done.progress.done).toBe(3);
    expect(done.counts.screened_out).toBe(3); // the fixture product is a dead listing
    expect([...repo.candidates.values()].filter((x) => x.status === 'screened_out')).toHaveLength(3);
    expect(repo.work.size).toBe(0);
  });

  it('says so when the queue is empty', async () => {
    const repo = new MemoryRepo();
    const job = newJob('vet', { limit: 3 }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(ctx(repo, feedFetch), job.id);
    expect(done.log.at(-1)?.text).toMatch(/Run an import first/);
  });

  it('refuses a second concurrent step instead of doubling work', async () => {
    const repo = new MemoryRepo();
    const job = newJob('vet', { limit: 1 }, 'admin');
    await repo.createJob(job);
    await repo.lockJob(job.id, 60_000, Date.now());
    const r = await stepJob(ctx(repo, feedFetch), job.id);
    expect(r.busy).toBe(true);
  });

  it('stops the job on an authorization error instead of failing every candidate', async () => {
    const repo = new MemoryRepo();
    const bad = (async () => new Response(JSON.stringify({ error_response: { code: 'IllegalAccessToken', msg: 'The specified access token is invalid' } }))) as unknown as typeof fetch;
    const c = ctx(repo, bad);
    repo.secretsDoc.aeRefreshToken = null;
    await repo.upsertCandidates([{ subId: '1', mainId: null, feeds: [], title: 't', department: 'men', categoryId: null, subcategoryName: null, shopId: null, recentSales: 1, feedPriceCents: null, status: 'new', reasons: [], nextCheckAt: null, attempts: 0, createdAt: 0, updatedAt: 0 }]);
    const job = newJob('vet', { limit: 5 }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(c, job.id);
    expect(done.status).toBe('error');
    expect(done.error).toMatch(/access token/i);
  });

  it('vets one chosen item when given its id, skipping the rest of the queue', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    const imp = newJob('import', { pages: 1, feeds: ['A'] }, 'admin');
    await repo.createJob(imp);
    await runToEnd(c, imp.id);
    const target = [...repo.candidates.keys()].at(-1)!;
    const job = newJob('vet', { subId: target, limit: 50 }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(c, job.id);
    expect(done.progress.done).toBe(1);
    expect(repo.candidates.get(target)!.status).toBe('screened_out');
    expect([...repo.candidates.values()].filter((x) => x.status === 'new')).toHaveLength(repo.candidates.size - 1);
  });

  it('keeps a Stop pressed while a step is running', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    const imp = newJob('import', { pages: 1, feeds: ['A'] }, 'admin');
    await repo.createJob(imp);
    await runToEnd(c, imp.id);
    const job = newJob('vet', { limit: 5 }, 'admin');
    await repo.createJob(job);
    // The admin stops the job while the step's API call is in flight.
    const slow = { ...c, ae: c.ae };
    const orig = repo.updateCandidate.bind(repo);
    repo.updateCandidate = async (id, patch) => {
      if (patch.status === 'vetting') await repo.updateJob(job.id, { status: 'stopped' });
      return orig(id, patch);
    };
    await stepJob(slow, job.id);
    expect((await repo.getJob(job.id))!.status).toBe('stopped');
  });

  it('tells credential problems apart from ordinary failures', () => {
    for (const m of ['AliExpress IllegalAccessToken: The specified access token is invalid', 'Claude API key is not set. Add it in Settings → Claude.', '401 {"type":"authentication_error"}', 'Your credit balance is too low']) {
      expect(AUTH_ERROR.test(m)).toBe(true);
    }
    for (const m of ['Model output failed validation (end_turn): Unexpected token } in JSON', 'max_tokens reached', 'fetch failed', 'AliExpress AppApiCallLimit: ban will last 1 seconds']) {
      expect(AUTH_ERROR.test(m)).toBe(false);
    }
  });

  it('gives up on an item whose step keeps getting cut off, instead of looping', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    await repo.upsertCandidates([{ subId: '9', mainId: null, feeds: [], title: 't', department: 'men', categoryId: null, subcategoryName: null, shopId: null, recentSales: 1, feedPriceCents: null, status: 'vetting', reasons: [], nextCheckAt: null, attempts: 0, createdAt: 0, updatedAt: 0 }]);
    // Three earlier requests died during the images stage without reporting back.
    await repo.saveWork({ subId: '9', stage: 'images', attempts: 3, candidate: (await repo.getCandidate('9'))!, startedAt: 0, updatedAt: 0 });
    const job = newJob('vet', { limit: 1 }, 'admin');
    await repo.createJob(job);
    const r = await stepJob(c, job.id);
    expect(r.job.counts.error).toBe(1);
    expect(repo.candidates.get('9')!.status).toBe('error');
    expect(repo.work.size).toBe(0);
  });

  it('skips a feed that keeps failing instead of retrying it forever', async () => {
    const repo = new MemoryRepo();
    const broken = (async (_u: string | URL, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body ?? ''));
      if (body.get('feed_name') === 'BAD') return new Response(JSON.stringify({ error_response: { code: 'isp.internal-error', msg: 'feed not found' } }));
      return feedFetch(_u, init);
    }) as typeof fetch;
    const c = ctx(repo, broken);
    const job = newJob('import', { pages: 1, feeds: ['BAD', 'A'] }, 'admin');
    await repo.createJob(job);
    const done = await runToEnd(c, job.id);
    expect(done.status).toBe('done');
    expect(done.counts.skipped).toBe(1);
    expect(repo.candidates.size).toBe(5);
  });

  it('pauses a listed product whose re-vet no longer passes', async () => {
    const repo = new MemoryRepo();
    const c = ctx(repo, feedFetch);
    await repo.upsertCandidates([{ subId: '7', mainId: 'M1', feeds: [], title: 't', department: 'men', categoryId: null, subcategoryName: null, shopId: null, recentSales: 1, feedPriceCents: null, status: 'new', reasons: [], nextCheckAt: null, attempts: 0, createdAt: 0, updatedAt: 0 }]);
    repo.products.set('ae-M1', { id: 'ae-M1', status: 'live', holdReasons: [] } as never);
    const job = newJob('vet', { subId: '7' }, 'admin');
    await repo.createJob(job);
    await runToEnd(c, job.id);
    expect(repo.candidates.get('7')!.status).toBe('screened_out');
    expect(repo.products.get('ae-M1')!.status).toBe('paused');
    expect(repo.products.get('ae-M1')!.holdReasons[0]).toMatch(/^Re-vet:/);
  });
});

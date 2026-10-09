/**
 * Jobs the dashboard runs: import, vet and monitor. A job is advanced by repeated short requests
 * (`stepJob`), each doing a bounded piece of work and saving progress, so nothing depends on one
 * long request staying open. A lock stops two browser tabs advancing the same job at once.
 */
import { randomUUID } from 'node:crypto';
import type { JobDoc, JobLogLine, JobType } from './firestore/model.ts';
import { advanceWork, failWork, importFeedPage, monitorProduct, newWork, type PipelineContext, US_FEEDS } from './stages.ts';

/** Longer than any single step can take (25 s of API work plus one Claude call). */
const LOCK_MS = 200_000;
const MAX_LOG = 200;
/** Keeps a job document far below Firestore's 1 MiB limit however long the messages get. */
const MAX_LINE = 400;
/** Consecutive failures on one feed page or product before a job skips it. */
const SKIP_AFTER = 3;
const STAGE_RETRIES = 3;
/** Credential problems fail every step the same way, so they stop the job instead of failing items. */
export const AUTH_ERROR =
  /access token|refresh token|IllegalAccessToken|TokenExpired|NoToken|authoriz|signature|appkey|app key|api key|authentication_error|permission_error|credit balance|recognise the model|\b401\b|\b403\b/i;

export function newJob(type: JobType, params: JobDoc['params'], createdBy: string, now = Date.now()): JobDoc {
  return {
    id: `${new Date(now).toISOString().replace(/[:.]/g, '-')}-${type}-${randomUUID().slice(0, 6)}`,
    type,
    status: 'running',
    params,
    cursor: type === 'import' ? { feedIndex: 0, page: 1 } : { current: null },
    progress: { done: 0, total: type === 'vet' ? params.limit ?? null : null },
    counts: {},
    log: [],
    lockedUntil: 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    error: null,
  };
}

export interface StepReport {
  job: JobDoc;
  busy?: boolean;
}

export async function stepJob(ctx: PipelineContext, jobId: string): Promise<StepReport> {
  const clock = ctx.now ?? Date.now;
  const now = clock();
  const before = await ctx.repo.getJob(jobId);
  if (!before) throw new Error('Job not found');
  if (before.status !== 'running') return { job: before };
  // Work from the job as read inside the lock, so a step that just finished elsewhere isn't undone.
  const job = await ctx.repo.lockJob(jobId, LOCK_MS, now);
  if (!job) return { job: before, busy: true };
  if (job.status !== 'running') {
    await ctx.repo.updateJob(jobId, { lockedUntil: 0 });
    return { job: { ...job, lockedUntil: 0 } };
  }

  const log: JobLogLine[] = [];
  const say = (text: string, extra: Partial<JobLogLine> = {}) => log.push({ at: clock(), text: text.slice(0, MAX_LINE), ...extra });
  const patch: Partial<JobDoc> = {};
  try {
    if (job.type === 'import') await importStep(ctx, job, patch, say);
    else if (job.type === 'vet') await vetStep(ctx, job, patch, say);
    else await monitorStep(ctx, job, patch, say);
  } catch (e) {
    const msg = (e as Error).message;
    say(`Error: ${msg}`, { outcome: 'error' });
    // Authorization problems will fail every step the same way: stop and say so.
    if (AUTH_ERROR.test(msg)) {
      patch.status = 'error';
      patch.error = msg.slice(0, MAX_LINE);
      patch.finishedAt = now;
    }
  }
  // Stop or Resume may have been pressed while this step ran: their status and log line win.
  const latest = (await ctx.repo.getJob(jobId)) ?? job;
  const stoppedMeanwhile = latest.status !== 'running';
  const merged: JobDoc = {
    ...job,
    ...patch,
    status: stoppedMeanwhile ? latest.status : (patch.status ?? 'running'),
    finishedAt: stoppedMeanwhile ? latest.finishedAt : (patch.finishedAt ?? job.finishedAt),
    error: stoppedMeanwhile ? latest.error : (patch.error ?? job.error),
    cursor: { ...job.cursor, ...(patch.cursor ?? {}) },
    counts: patch.counts ?? job.counts,
    log: [...latest.log, ...log].slice(-MAX_LOG),
    lockedUntil: 0,
    updatedAt: clock(),
  };
  await ctx.repo.updateJob(jobId, merged);
  return { job: merged };
}

type Say = (text: string, extra?: Partial<JobLogLine>) => void;

async function importStep(ctx: PipelineContext, job: JobDoc, patch: Partial<JobDoc>, say: Say) {
  const feeds = job.params.feeds?.length ? job.params.feeds : US_FEEDS;
  const pages = job.params.pages ?? 5;
  let { feedIndex = 0, page = 1 } = job.cursor;
  const counts = { ...job.counts };
  // A few pages per request: each is one ~1-second API call.
  let failures = job.cursor.failures ?? 0;
  for (let n = 0; n < 3 && feedIndex < feeds.length; n++) {
    const feed = feeds[feedIndex]!;
    let r;
    try {
      r = await importFeedPage(ctx, feed, page);
    } catch (e) {
      const msg = (e as Error).message;
      if (AUTH_ERROR.test(msg)) throw e;
      failures += 1;
      if (failures < SKIP_AFTER) {
        say(`${feed}, page ${page}: ${msg}. Retrying.`, { outcome: 'error' });
        break;
      }
      say(`${feed}: skipped after ${SKIP_AFTER} failures (${msg})`, { outcome: 'error' });
      counts.skipped = (counts.skipped ?? 0) + 1;
      failures = 0;
      feedIndex += 1;
      page = 1;
      continue;
    }
    failures = 0;
    counts.seen = (counts.seen ?? 0) + r.seen;
    counts.added = (counts.added ?? 0) + r.added;
    counts.updated = (counts.updated ?? 0) + r.updated;
    say(`${feed}, page ${page}: ${r.seen} men's items (${r.added} new)`);
    if (r.finished || page >= pages) {
      feedIndex += 1;
      page = 1;
    } else {
      page += 1;
    }
  }
  patch.cursor = { feedIndex, page, failures };
  patch.counts = counts;
  patch.progress = { done: Math.min(feedIndex, feeds.length), total: feeds.length };
  if (feedIndex >= feeds.length) {
    patch.status = 'done';
    patch.finishedAt = Date.now();
    say(`Import finished: ${counts.added ?? 0} new candidates, ${counts.updated ?? 0} already in the queue`);
  }
}

async function vetStep(ctx: PipelineContext, job: JobDoc, patch: Partial<JobDoc>, say: Say) {
  const now = (ctx.now ?? Date.now)();
  const counts = { ...job.counts };
  let current = job.cursor.current ?? null;
  const limit = job.params.subId ? 1 : job.params.limit ?? 10;

  if (!current) {
    if (job.progress.done >= limit) {
      patch.status = 'done';
      patch.finishedAt = now;
      return;
    }
    // Finish vetting a stopped job left half-done before starting anything new.
    const [orphan] = job.params.subId ? [await ctx.repo.getWork(job.params.subId)] : await ctx.repo.listWork(1);
    if (orphan) {
      current = orphan.subId;
      say(`Resuming ${orphan.subId}: ${orphan.candidate.title.slice(0, 80)}`);
    }
  }
  if (!current) {
    const [next] = job.params.subId
      ? [await ctx.repo.getCandidate(job.params.subId)].filter((c) => c !== null)
      : await ctx.repo.dueCandidates(1, now);
    if (!next) {
      patch.status = 'done';
      patch.finishedAt = now;
      say(
        job.params.subId
          ? 'That item is no longer in the queue.'
          : job.progress.done
            ? 'No more candidates waiting.'
            : 'No candidates waiting. Run an import first.',
      );
      return;
    }
    const existing = await ctx.repo.getWork(next.subId);
    await ctx.repo.saveWork(existing ?? newWork(next, now));
    await ctx.repo.updateCandidate(next.subId, { status: 'vetting' });
    current = next.subId;
    say(`Vetting ${next.subId}: ${next.title.slice(0, 80)}`);
  }

  const work = await ctx.repo.getWork(current);
  if (!work) {
    patch.cursor = { current: null };
    return;
  }
  let res;
  if (work.attempts >= STAGE_RETRIES) {
    // Three tries at this stage already, including requests the platform cut off mid-way.
    res = await failWork(ctx, work, work.lastError ?? 'it did not finish in time');
  } else {
    // Count the try before running it, so a request killed by a server timeout still counts.
    work.attempts += 1;
    await ctx.repo.saveWork(work);
    try {
      res = await advanceWork(ctx, work);
    } catch (e) {
      const msg = (e as Error).message;
      if (AUTH_ERROR.test(msg)) {
        await ctx.repo.saveWork({ ...work, attempts: Math.max(0, work.attempts - 1) });
        throw e;
      }
      await ctx.repo.saveWork({ ...work, lastError: msg.slice(0, MAX_LINE) });
      say(`Retrying "${stageLabel(work.stage)}" (${msg})`);
      patch.cursor = { current };
      return;
    }
  }
  if (res.finished) {
    counts[res.outcome!] = (counts[res.outcome!] ?? 0) + 1;
    patch.counts = counts;
    patch.progress = { done: job.progress.done + 1, total: limit };
    patch.cursor = { current: null };
    say(`${outcomeLabel(res.outcome!)}: ${(res.reasons ?? []).slice(0, 2).join('; ') || 'no reasons recorded'}`, {
      outcome: res.outcome,
      productId: res.productId,
    });
    if (job.progress.done + 1 >= limit) {
      patch.status = 'done';
      patch.finishedAt = now;
    }
  } else {
    patch.cursor = { current };
    say(`  ${current}: ${stageLabel(res.work!.stage)}`);
  }
}

async function monitorStep(ctx: PipelineContext, job: JobDoc, patch: Partial<JobDoc>, say: Say) {
  let queue = job.cursor.queue;
  if (!queue) {
    queue = (await ctx.repo.listProducts(['live', 'pending_review', 'paused'])).map((p) => p.id);
    patch.progress = { done: 0, total: queue.length };
    say(`Checking ${queue.length} product(s)`);
  }
  const counts = { ...job.counts };
  const [id, ...rest] = queue;
  if (id) {
    const p = await ctx.repo.getProduct(id);
    if (p) {
      try {
        const r = await monitorProduct(ctx, p);
        counts[r.changed ? 'changed' : 'unchanged'] = (counts[r.changed ? 'changed' : 'unchanged'] ?? 0) + 1;
        say(`${p.title.slice(0, 60)}: ${r.notes.length ? r.notes.join('; ') : 'no changes'}`, { productId: id, outcome: r.changed ? 'held' : undefined });
      } catch (e) {
        const msg = (e as Error).message;
        if (AUTH_ERROR.test(msg)) throw e;
        const failures = (job.cursor.failures ?? 0) + 1;
        if (failures < SKIP_AFTER) {
          say(`${p.title.slice(0, 60)}: ${msg}. Retrying.`, { productId: id, outcome: 'error' });
          patch.cursor = { queue, failures };
          patch.counts = counts;
          return;
        }
        counts.skipped = (counts.skipped ?? 0) + 1;
        say(`${p.title.slice(0, 60)}: skipped after ${SKIP_AFTER} failures (${msg})`, { productId: id, outcome: 'error' });
      }
    }
  }
  patch.cursor = { queue: rest, failures: 0 };
  patch.counts = counts;
  const total = patch.progress?.total ?? job.progress.total ?? queue.length;
  patch.progress = { done: total - rest.length, total };
  if (!rest.length) {
    patch.status = 'done';
    patch.finishedAt = Date.now();
    say('Monitoring finished');
  }
}

export function outcomeLabel(o: string): string {
  return (
    {
      ready: 'Passed: ready for your review',
      published: 'Published',
      held: 'Held for your review',
      insufficient_data: 'Not enough data yet',
      rejected: 'Rejected',
      screened_out: 'Screened out',
      error: 'Error',
    } as Record<string, string>
  )[o] ?? o;
}

export function stageLabel(s: string): string {
  return (
    {
      fetch: 'checking the listing and shipping',
      reviews: 'reading reviews',
      images: 'checking photos for brands and likenesses',
      analysis: 'analysing reviews',
      decide: 'deciding',
      seller_chart: "reading the seller's size chart",
      us_chart: 'building the US size guide',
      shipping: 'quoting shipping per size',
      listing: 'writing the listing',
      save: 'saving',
    } as Record<string, string>
  )[s] ?? s;
}

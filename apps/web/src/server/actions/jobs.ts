'use server';

import type { JobDoc, JobType } from '@/core/firestore/model.ts';
import { newJob, stepJob as coreStep } from '@/core/jobs.ts';
import { US_FEEDS } from '@/core/stages.ts';
import { adminOrThrow } from '../auth.ts';
import { pipelineContext } from '../context.ts';
import { repo } from '../firebase.ts';
import { fail, type Result } from './result.ts';

/** A running job nobody has stepped for this long is treated as paused (its tab was closed). */
const IDLE_MS = 2 * 60_000;

export async function startJob(
  type: JobType,
  params: { limit?: number; pages?: number; feeds?: string[]; subId?: string } = {},
): Promise<Result<{ job: JobDoc }>> {
  try {
    const me = await adminOrThrow();
    const r = repo();
    const active = (await r.listJobs(20)).find((j) => j.status === 'running');
    if (active) {
      return { ok: false, error: `A ${active.type} job is already running. Resume or stop it first.` };
    }
    const settings = await r.settings();
    const p = { ...params };
    if (type === 'import') {
      p.feeds = p.feeds?.length ? p.feeds : settings.feeds?.length ? settings.feeds : US_FEEDS;
      p.pages = clamp(p.pages ?? settings.importPages ?? 5, 1, 50);
    }
    if (type === 'vet') p.limit = clamp(p.limit ?? 10, 1, 500);
    const job = newJob(type, p, me.email || me.uid);
    await r.createJob(job);
    return { ok: true, job };
  } catch (e) {
    return fail(e);
  }
}

/** Advances a job by one short step. The Run page calls this in a loop while the tab is open. */
export async function stepJob(id: string): Promise<Result<{ job: JobDoc; busy: boolean }>> {
  try {
    await adminOrThrow();
    let ctx;
    try {
      ctx = await pipelineContext();
    } catch (e) {
      const msg = (e as Error).message;
      await repo().updateJob(id, { status: 'error', error: msg, finishedAt: Date.now() });
      const job = await repo().getJob(id);
      return job ? { ok: true, job, busy: false } : fail(e);
    }
    const r = await coreStep(ctx, id);
    return { ok: true, job: r.job, busy: !!r.busy };
  } catch (e) {
    return fail(e);
  }
}

export async function stopJob(id: string): Promise<Result> {
  try {
    await adminOrThrow();
    const job = await repo().getJob(id);
    if (!job) return { ok: false, error: 'Job not found' };
    if (job.status === 'running') {
      await repo().updateJob(id, {
        status: 'stopped',
        finishedAt: Date.now(),
        log: [...job.log, { at: Date.now(), text: 'Stopped by you. Vetting in progress is kept and resumes with the next vet job.' }].slice(-200),
      });
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resumeJob(id: string): Promise<Result<{ job: JobDoc }>> {
  try {
    await adminOrThrow();
    const r = repo();
    const job = await r.getJob(id);
    if (!job) return { ok: false, error: 'Job not found' };
    const other = (await r.listJobs(20)).find((j) => j.status === 'running' && j.id !== id);
    if (other) return { ok: false, error: `A ${other.type} job is already running. Stop it first.` };
    // The lock is left alone: a step still finishing from before the Stop keeps it until it returns.
    if (job.status !== 'running') {
      await r.updateJob(id, { status: 'running', finishedAt: null, error: null });
    }
    return { ok: true, job: { ...job, status: 'running', finishedAt: null, error: null } };
  } catch (e) {
    return fail(e);
  }
}

export async function getJob(id: string): Promise<Result<{ job: JobDoc; idle: boolean }>> {
  try {
    await adminOrThrow();
    const job = await repo().getJob(id);
    if (!job) return { ok: false, error: 'Job not found' };
    return { ok: true, job, idle: job.status === 'running' && Date.now() - job.updatedAt > IDLE_MS };
  } catch (e) {
    return fail(e);
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(Number.isFinite(n) ? n : lo)));
}

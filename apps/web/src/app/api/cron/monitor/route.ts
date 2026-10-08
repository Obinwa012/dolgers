import { NextResponse } from 'next/server';
import type { JobDoc } from '@/core/firestore/model.ts';
import { newJob, stepJob } from '@/core/jobs.ts';
import { pipelineContext } from '@/server/context.ts';
import { db, repo } from '@/server/firebase.ts';

/**
 * The daily Monitor, called by a scheduled GitHub Action (.github/workflows/monitor.yml) until it
 * reports the run finished. It needs no key because all it can do is start the Monitor at most once
 * every 20 hours and advance that run, reading only a few documents per call. Its answers carry
 * progress counts only; errors are in the job log on the dashboard.
 */
const EVERY_MS = 20 * 3600 * 1000;
/** A dashboard job nobody has stepped for this long was left behind by a closed tab. */
const ABANDONED_MS = 30 * 60 * 1000;
export const dynamic = 'force-dynamic';

interface Schedule {
  monitorJobId?: string;
  monitorStartedAt?: number;
}

export async function POST() {
  const r = repo();
  const now = Date.now();
  const scheduleRef = db().doc('config/schedule');
  const schedule = ((await scheduleRef.get()).data() as Schedule | undefined) ?? {};
  let job = schedule.monitorJobId ? await r.getJob(schedule.monitorJobId) : null;

  if (!job || job.status !== 'running') {
    if (schedule.monitorStartedAt && now - schedule.monitorStartedAt < EVERY_MS) {
      return NextResponse.json({ state: 'not_due', lastRun: new Date(schedule.monitorStartedAt).toISOString() });
    }
    const running = (await db().collection('jobs').where('status', '==', 'running').limit(5).get()).docs.map((d) => d.data() as JobDoc);
    const active = running.filter((j) => now - j.updatedAt < ABANDONED_MS);
    if (active.length) return NextResponse.json({ state: 'busy' });
    for (const j of running) {
      await r.updateJob(j.id, {
        status: 'stopped',
        finishedAt: now,
        log: [...j.log, { at: now, text: 'Stopped: no browser tab was running it. Press Resume to carry on.' }].slice(-200),
      });
    }
    let ctx;
    try {
      ctx = await pipelineContext();
    } catch {
      return NextResponse.json({ state: 'error' }, { status: 503 }); // e.g. AliExpress keys not set yet
    }
    job = newJob('monitor', {}, 'schedule', now);
    await r.createJob(job);
    await scheduleRef.set({ monitorJobId: job.id, monitorStartedAt: now }, { merge: true });
    return step(ctx, job.id);
  }
  let ctx;
  try {
    ctx = await pipelineContext();
  } catch {
    return NextResponse.json({ state: 'error' }, { status: 503 });
  }
  return step(ctx, job.id);
}

async function step(ctx: Awaited<ReturnType<typeof pipelineContext>>, id: string) {
  const res = await stepJob(ctx, id);
  return NextResponse.json({ state: res.busy ? 'running' : res.job.status, progress: res.job.progress, counts: res.job.counts });
}

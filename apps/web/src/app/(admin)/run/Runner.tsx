'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, btn, Card, Empty, Field, input } from '@/components/ui.tsx';
import type { JobDoc, JobType } from '@/core/firestore/model.ts';
import { ago, clock, OUTCOME_LABEL, toneFor, when } from '@/lib/format.ts';
import { resumeJob, startJob, stepJob, stopJob } from '@/server/actions/jobs.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Runner({
  initialJobs,
  selected,
  feeds,
  importPages,
  waiting,
  missing,
}: {
  initialJobs: JobDoc[];
  selected: JobDoc | null;
  feeds: string[];
  importPages: number;
  waiting: number;
  missing: string[];
}) {
  const router = useRouter();
  const running = initialJobs.find((j) => j.status === 'running') ?? null;
  const [job, setJob] = useState<JobDoc | null>(selected ?? running ?? initialJobs[0] ?? null);
  const [driving, setDriving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  // Each drive loop has an id; starting a new loop or pressing Stop retires the old one, so one
  // tab never runs two loops. `live` counts loops still awaiting a step.
  const loopRef = useRef(0);
  const live = useRef(0);
  const attached = useRef(false);

  const [pages, setPages] = useState(importPages);
  const [chosenFeeds, setChosenFeeds] = useState<string[]>(feeds);
  const [limit, setLimit] = useState(10);

  const drive = useCallback(
    async (id: string) => {
      attached.current = true;
      const me = ++loopRef.current;
      live.current += 1;
      setDriving(true);
      setError('');
      let failures = 0;
      try {
        while (loopRef.current === me) {
          // A request the server cut off (timeout, deploy, lost connection) throws here; treat it like a failed step.
          const r = await stepJob(id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'The step did not finish.' }));
          if (loopRef.current !== me) break;
          if (!r.ok) {
            failures += 1;
            setError(`${r.error}${failures < 4 ? ' Retrying…' : ' Press Resume to try again.'}`);
            if (failures >= 4) break;
            await sleep(3000 * failures);
            continue;
          }
          failures = 0;
          setError('');
          setJob(r.job);
          if (r.job.status !== 'running') break;
          if (r.busy) {
            setNote('Waiting for the previous step to finish (another tab, or a step that was cut off; up to about 3 minutes)…');
            await sleep(5000);
          } else {
            setNote('');
            // Give AliExpress a breather after a failed attempt.
            await sleep(/Retrying|Error:/.test(r.job.log.at(-1)?.text ?? '') ? 3000 : 250);
          }
        }
      } finally {
        live.current -= 1;
        if (live.current === 0) {
          setDriving(false);
          setNote('');
          router.refresh();
        }
      }
    },
    [router],
  );

  // Pick up a job left running (for example after a reload).
  useEffect(() => {
    if (!attached.current && running && (!selected || selected.id === running.id)) void drive(running.id);
  }, [running, selected, drive]);

  useEffect(() => {
    if (!driving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [driving]);

  async function start(type: JobType, params: Parameters<typeof startJob>[1]) {
    setError('');
    const r = await startJob(type, params);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    attached.current = true;
    setJob(r.job);
    router.replace('/run');
    void drive(r.job.id);
  }

  async function stop() {
    if (!job) return;
    loopRef.current += 1; // retire the running loop; a step already in flight finishes on the server
    const r = await stopJob(job.id);
    if (!r.ok) setError(r.error);
    setJob({ ...job, status: 'stopped' });
    router.refresh();
  }

  async function resume() {
    if (!job || driving) return;
    const r = await resumeJob(job.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setJob(r.job);
    void drive(r.job.id);
  }

  const busy = driving || job?.status === 'running';
  const blockedByOther = !!running && running.id !== job?.id;

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <div className="rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
          Before running jobs, add {missing.join(', ')} in <Link href="/settings" className="font-semibold underline">Settings</Link>.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="1 · Import">
          <p className="mb-3 text-ink-soft">Adds men’s clothing from the US feeds to the queue, best sellers first. Nothing is published by an import.</p>
          <Field label="Pages per feed" hint="Each page is about 50 items.">
            <input type="number" min={1} max={50} className={input} value={pages} onChange={(e) => setPages(Number(e.target.value))} />
          </Field>
          <fieldset className="mt-3">
            <legend className="mb-1 text-sm font-semibold">Feeds</legend>
            {feeds.map((f) => (
              <label key={f} className="flex items-center gap-2 py-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={chosenFeeds.includes(f)}
                  onChange={(e) => setChosenFeeds(e.target.checked ? [...chosenFeeds, f] : chosenFeeds.filter((x) => x !== f))}
                />
                <span className="truncate">{f}</span>
              </label>
            ))}
          </fieldset>
          <button className={`${btn.primary} mt-4 w-full`} disabled={busy || blockedByOther || !chosenFeeds.length} onClick={() => start('import', { pages, feeds: chosenFeeds })}>
            Start import
          </button>
        </Card>

        <Card title="2 · Vet">
          <p className="mb-3 text-ink-soft">
            Vets the next items in the queue ({waiting} waiting). Passes go live; borderline items wait for you under Products → Needs review.
          </p>
          <Field label="How many items" hint="Most items stop at the cheap checks. A full vet with reviews and AI takes 1–3 minutes.">
            <input type="number" min={1} max={500} className={input} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </Field>
          <button className={`${btn.primary} mt-4 w-full`} disabled={busy || blockedByOther} onClick={() => start('vet', { limit })}>
            Start vetting
          </button>
        </Card>

        <Card title="3 · Monitor">
          <p className="mb-3 text-ink-soft">
            Re-checks every live, held and paused product for price, stock and shipping changes. Big cost changes pause a product until you reprice it.
          </p>
          <button className={`${btn.secondary} mt-4 w-full`} disabled={busy || blockedByOther} onClick={() => start('monitor', {})}>
            Check products now
          </button>
        </Card>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-bad/30 bg-bad-bg px-4 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {job ? <JobPanel job={job} driving={driving} note={note} onStop={stop} onResume={resume} canResume={!blockedByOther} /> : <Empty>No jobs yet. Start with an import.</Empty>}

      <Card title="Job history">
        {initialJobs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Progress</th>
                  <th className="py-2 pr-3">Results</th>
                  <th className="py-2">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {initialJobs.map((j) => (
                  <tr key={j.id} className={j.id === job?.id ? 'bg-mist/50' : ''}>
                    <td className="py-2 pr-3">
                      <Link href={`/run?job=${j.id}`} className={btn.link}>{when(j.createdAt)}</Link>
                    </td>
                    <td className="py-2 pr-3 capitalize">{j.type}</td>
                    <td className="py-2 pr-3"><Badge status={j.status}>{j.status}</Badge></td>
                    <td className="tabular py-2 pr-3">{j.progress.done}{j.progress.total ? ` / ${j.progress.total}` : ''}</td>
                    <td className="py-2 pr-3 text-xs text-ink-soft">{countsText(j.counts)}</td>
                    <td className="py-2 text-xs text-ink-soft">{j.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-soft">Nothing yet.</p>
        )}
      </Card>
    </div>
  );
}

function countsText(c: Record<string, number>) {
  return (
    Object.entries(c)
      .filter(([, v]) => v)
      .map(([k, v]) => `${OUTCOME_LABEL[k] ?? k}: ${v}`)
      .join(' · ') || '—'
  );
}

function JobPanel({
  job,
  driving,
  note,
  onStop,
  onResume,
  canResume,
}: {
  job: JobDoc;
  driving: boolean;
  note: string;
  onStop: () => void;
  onResume: () => void;
  canResume: boolean;
}) {
  const total = job.progress.total;
  const pct = total ? Math.min(100, Math.round((job.progress.done / total) * 100)) : null;
  const logRef = useRef<HTMLOListElement>(null);
  const lines = [...job.log].reverse();
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="capitalize">{job.type} job</span>
          <Badge status={job.status}>{job.status === 'running' && !driving ? 'paused' : job.status}</Badge>
        </span>
      }
      action={
        <div className="flex gap-2">
          {job.status === 'running' && (driving ? (
            <button className={btn.danger} onClick={onStop}>Stop</button>
          ) : (
            <>
              <button className={btn.primary} onClick={onResume} disabled={!canResume || driving}>Resume</button>
              <button className={btn.danger} onClick={onStop}>Stop</button>
            </>
          ))}
          {(job.status === 'stopped' || job.status === 'error') && (
            <button className={btn.primary} onClick={onResume} disabled={!canResume || driving} title={driving ? 'Waiting for the last step to finish' : undefined}>
              {driving ? 'Finishing step…' : 'Resume'}
            </button>
          )}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
        <span>Started {when(job.createdAt)} by {job.createdBy}</span>
        <span suppressHydrationWarning>Last step {ago(job.updatedAt)}</span>
        {job.type === 'import' && <span>{job.params.pages} page{job.params.pages === 1 ? '' : 's'} × {job.params.feeds?.length ?? 0} feed{job.params.feeds?.length === 1 ? '' : 's'}</span>}
        {job.type === 'vet' && job.params.subId && <span>Item {job.params.subId}</span>}
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full bg-denim transition-all ${pct === null && job.status === 'running' ? 'w-1/3 animate-pulse' : ''}`} style={pct !== null ? { width: `${pct}%` } : undefined} />
      </div>
      <p className="tabular mb-3 text-sm">
        <strong>{job.progress.done}</strong>
        {total ? ` of ${total}` : ''} {job.type === 'import' ? 'feeds done' : job.type === 'vet' ? 'items vetted' : 'products checked'}
        {countsText(job.counts) !== '—' && <span className="text-ink-soft"> · {countsText(job.counts)}</span>}
      </p>
      {job.error && <p className="mb-3 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{job.error}{/settings|token|key|authoriz/i.test(job.error) && <> · <Link href="/settings" className="font-semibold underline">Settings</Link></>}</p>}
      {note && <p className="mb-3 text-sm text-warn">{note}</p>}
      <ol ref={logRef} className="max-h-[28rem] overflow-y-auto rounded-md border border-line bg-canvas p-3 font-mono text-xs leading-relaxed">
        {lines.length ? (
          lines.map((l, i) => (
            <li key={`${l.at}-${i}`} className="flex gap-3">
              <span className="shrink-0 text-ink-soft">{clock(l.at)}</span>
              <span className={l.outcome ? (toneFor(l.outcome) === 'good' ? 'text-good' : toneFor(l.outcome) === 'bad' ? 'text-bad' : toneFor(l.outcome) === 'warn' ? 'text-warn' : '') : ''}>
                {l.text}
                {l.productId && (
                  <>
                    {' '}
                    <Link href={`/products/${l.productId}`} className="font-sans font-semibold text-denim underline">open</Link>
                  </>
                )}
              </span>
            </li>
          ))
        ) : (
          <li className="text-ink-soft">Starting…</li>
        )}
      </ol>
    </Card>
  );
}

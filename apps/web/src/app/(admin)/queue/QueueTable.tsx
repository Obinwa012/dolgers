'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge, btn } from '@/components/ui.tsx';
import type { CandidateStatus } from '@/core/firestore/model.ts';
import { ago, CANDIDATE_STATUS_LABEL, money, until } from '@/lib/format.ts';
import { type BulkAction, bulkCandidates, bulkCandidatesByStatus } from '@/server/actions/catalog.ts';
import { QueueActions } from './QueueActions.tsx';

export interface QueueRow {
  subId: string;
  mainId: string | null;
  title: string;
  subcategoryName: string | null;
  status: CandidateStatus;
  recentSales: number;
  feedPriceCents: number | null;
  reasons: string[];
  nextCheckAt: number | null;
  attempts: number;
  updatedAt: number;
}

const LABEL: Record<BulkAction, string> = { delete: 'Delete', skip: 'Skip', requeue: 'Requeue' };
const EXPLAIN: Record<BulkAction, string> = {
  delete: 'Deleted items are removed from the queue. A later import can add them back.',
  skip: 'Skipped items stay on record as rejected, so they are never vetted or imported again.',
  requeue: 'Requeued items go back in line to be vetted.',
};

export function QueueTable({ rows, status, total, now }: { rows: QueueRow[]; status: CandidateStatus; total: number; now: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allInTab, setAllInTab] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setSelected(new Set());
    setAllInTab(false);
  }, [status, rows]);

  const allVisible = rows.length > 0 && rows.every((r) => selected.has(r.subId));
  const count = allInTab ? total : selected.size;
  const actions = useMemo<BulkAction[]>(() => {
    const a: BulkAction[] = ['delete'];
    if (status !== 'rejected' && status !== 'published') a.unshift('skip');
    if (status !== 'new' && status !== 'published') a.unshift('requeue');
    return a;
  }, [status]);

  const toggle = (id: string) => {
    setAllInTab(false);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  async function run(action: BulkAction) {
    const what = `${LABEL[action].toLowerCase()} ${count.toLocaleString()} item${count === 1 ? '' : 's'}${allInTab ? ` (everything under “${CANDIDATE_STATUS_LABEL[status]}”)` : ''}`;
    if (!window.confirm(`${LABEL[action]} ${count.toLocaleString()} item${count === 1 ? '' : 's'}?\n\n${EXPLAIN[action]}`)) return;
    setBusy(true);
    setMsg(null);
    let done = 0;
    let skipped = 0;
    try {
      if (allInTab) {
        // Large tabs go in chunks of 1,000 so no single request runs long.
        for (let i = 0; i < 100; i++) {
          const r = await bulkCandidatesByStatus(action, status);
          if (!r.ok) throw new Error(r.error);
          done += r.done;
          skipped += r.skipped;
          setMsg({ ok: true, text: `Working… ${done.toLocaleString()} done${r.remaining ? `, ${r.remaining.toLocaleString()} left` : ''}` });
          if (!r.remaining) break;
        }
      } else {
        const ids = [...selected];
        for (let i = 0; i < ids.length; i += 1000) {
          const r = await bulkCandidates(action, ids.slice(i, i + 1000));
          if (!r.ok) throw new Error(r.error);
          done += r.done;
          skipped += r.skipped;
        }
      }
      setMsg({
        ok: true,
        text: `Done: ${what.replace(/^\w/, (c) => c.toUpperCase())} — ${done.toLocaleString()} changed${skipped ? `, ${skipped} left alone (being vetted right now, or already published)` : ''}.`,
      });
      setSelected(new Set());
      setAllInTab(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: `${(e as Error).message}${done ? ` (${done.toLocaleString()} were already done)` : ''}` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-1 mb-2 flex min-h-11 flex-wrap items-center gap-2 bg-canvas/95 px-1 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-4"
            checked={allVisible}
            onChange={(e) => {
              setAllInTab(false);
              setSelected(e.target.checked ? new Set(rows.map((r) => r.subId)) : new Set());
            }}
            aria-label="Select all shown"
          />
          {count ? `${count.toLocaleString()} selected` : 'Select'}
        </label>
        {allVisible && total > rows.length && !allInTab && (
          <button type="button" className={btn.link} onClick={() => setAllInTab(true)}>
            Select all {total.toLocaleString()} in “{CANDIDATE_STATUS_LABEL[status]}”
          </button>
        )}
        {allInTab && (
          <button type="button" className={btn.link} onClick={() => { setAllInTab(false); setSelected(new Set()); }}>
            Clear selection
          </button>
        )}
        {count > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {actions.map((a) => (
              <button key={a} type="button" disabled={busy} className={a === 'delete' ? btn.danger : btn.secondary} onClick={() => run(a)}>
                {busy ? 'Working…' : `${LABEL[a]} ${count.toLocaleString()}`}
              </button>
            ))}
          </div>
        )}
      </div>
      {msg && <p role="status" className={`mb-2 rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{msg.text}</p>}
      <div className="overflow-x-auto rounded-lg border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="w-10 px-3 py-2.5" />
              <th className="px-2 py-2.5">Item</th>
              <th className="px-3 py-2.5 text-right">Sold</th>
              <th className="px-3 py-2.5 text-right">Feed price</th>
              <th className="px-3 py-2.5">Why it’s here</th>
              <th className="px-3 py-2.5">Next check</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => {
              const on = allInTab || selected.has(c.subId);
              return (
                <tr key={c.subId} className={`align-top ${on ? 'bg-info-bg/50' : ''}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" className="size-4" checked={on} onChange={() => toggle(c.subId)} aria-label={`Select ${c.title}`} />
                  </td>
                  <td className="max-w-md px-2 py-2.5">
                    <a href={`https://www.aliexpress.com/item/${c.mainId ?? c.subId}.html`} target="_blank" rel="noreferrer" className="line-clamp-2 font-semibold hover:text-denim">
                      {c.title}
                    </a>
                    <span className="block text-xs text-ink-soft">
                      {c.subId} · {c.subcategoryName ?? 'Men’s clothing'} · updated <span suppressHydrationWarning>{ago(c.updatedAt, now)}</span>
                      {c.attempts > 0 && ` · ${c.attempts} attempt${c.attempts === 1 ? '' : 's'}`}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{c.recentSales.toLocaleString()}</td>
                  <td className="tabular px-3 py-2.5 text-right">{money(c.feedPriceCents)}</td>
                  <td className="max-w-sm px-3 py-2.5 text-xs">
                    {c.reasons.length ? c.reasons.slice(0, 3).map((r) => <p key={r}>{r}</p>) : <span className="text-ink-soft">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">
                    {c.nextCheckAt ? (c.nextCheckAt > now ? `in ${until(c.nextCheckAt, now)}` : <Badge tone="info">due</Badge>) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <QueueActions subId={c.subId} status={c.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

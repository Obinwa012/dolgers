import Link from 'next/link';
import { Badge, Empty, PageHeader, Tabs } from '@/components/ui.tsx';
import type { CandidateStatus } from '@/core/firestore/model.ts';
import { ago, CANDIDATE_STATUS_LABEL, money, until } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { CANDIDATE_STATUSES, candidateCounts } from '@/server/queries.ts';
import { QueueActions } from './QueueActions.tsx';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Queue' };
const LIMIT = 200;

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status: CandidateStatus = (CANDIDATE_STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as CandidateStatus) : 'new';
  const [counts, list] = await Promise.all([candidateCounts(), repo().listCandidates(status, LIMIT)]);
  const items = status === 'new' ? [...list].sort((a, b) => b.recentSales - a.recentSales) : list;
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Queue"
        sub="Every men’s item imported from the US feeds and where it stopped. Screened-out and not-enough-data items are re-checked automatically when their date comes."
      />
      <Tabs
        current={status}
        items={CANDIDATE_STATUSES.map((s) => ({ key: s, label: CANDIDATE_STATUS_LABEL[s]!, count: counts[s], href: `/queue?status=${s}` }))}
      />
      {items.length ? (
        <>
          {counts[status] > LIMIT && <p className="mb-2 text-xs text-ink-soft">Showing {LIMIT} of {counts[status]}.</p>}
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Sold</th>
                  <th className="px-3 py-2.5 text-right">Feed price</th>
                  <th className="px-3 py-2.5">Why it’s here</th>
                  <th className="px-3 py-2.5">Next check</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((c) => (
                  <tr key={c.subId} className="align-top">
                    <td className="max-w-md px-4 py-2.5">
                      <a href={`https://www.aliexpress.com/item/${c.mainId ?? c.subId}.html`} target="_blank" rel="noreferrer" className="line-clamp-2 font-semibold hover:text-denim">
                        {c.title}
                      </a>
                      <span className="block text-xs text-ink-soft">
                        {c.subId} · {c.subcategoryName ?? 'Men’s clothing'} · updated {ago(c.updatedAt, now)}
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty>
          {status === 'new' ? (
            <>The queue is empty. <Link href="/run" className="font-semibold text-denim underline">Run an import</Link> to fill it.</>
          ) : (
            'Nothing here.'
          )}
        </Empty>
      )}
    </>
  );
}

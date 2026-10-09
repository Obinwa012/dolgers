import Link from 'next/link';
import { Empty, PageHeader, Tabs } from '@/components/ui.tsx';
import type { CandidateStatus } from '@/core/firestore/model.ts';
import { CANDIDATE_STATUS_LABEL } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { CANDIDATE_STATUSES, candidateCounts } from '@/server/queries.ts';
import { QueueTable } from './QueueTable.tsx';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Queue' };
const LIMIT = 300;

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
          {counts[status] > LIMIT && <p className="mb-2 text-xs text-ink-soft">Showing {LIMIT} of {counts[status].toLocaleString()}. Tick the box at the top, then “Select all” to act on every item in this tab.</p>}
          <QueueTable
            status={status}
            total={counts[status]}
            now={now}
            rows={items.map((c) => ({
              subId: c.subId, mainId: c.mainId, title: c.title, subcategoryName: c.subcategoryName, status: c.status,
              recentSales: c.recentSales, feedPriceCents: c.feedPriceCents, reasons: c.reasons, nextCheckAt: c.nextCheckAt,
              attempts: c.attempts, updatedAt: c.updatedAt,
            }))}
          />
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

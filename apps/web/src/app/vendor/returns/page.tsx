'use client';

import { collection, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useState } from 'react';
import { RETURN_WINDOW_DAYS, formatMoney, type ReturnRequest, type ReturnStatus } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { formatDate } from '@/components/dashboard/format';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, FilterTabs, Loading, PageHeader, StatusBadge, btnSm } from '@/components/dashboard/ui';
import { vendorApi } from '@/lib/firebase/api';

type Filter = 'open' | ReturnStatus | 'all';
type Pending = { kind: 'approve' | 'reject' | 'refund'; ret: ReturnRequest } | null;

export default function VendorReturnsPage() {
  const { vendorId } = useDashboard();
  const returns = useLiveQuery<ReturnRequest>(`returns:${vendorId}`, (db) =>
    query(collection(db, 'returns'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc')));
  const [filter, setFilter] = useState<Filter>('open');
  const [pending, setPending] = useState<Pending>(null);

  const match = (r: ReturnRequest) =>
    filter === 'all' ? true : filter === 'open' ? r.status === 'requested' || r.status === 'approved' : r.status === filter;
  const rows = returns.data.filter(match);
  const count = (f: Filter) => returns.data.filter((r) => (f === 'open' ? r.status === 'requested' || r.status === 'approved' : f === 'all' || r.status === f)).length;

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Returns"
        description={`Shoppers can return unworn items within ${RETURN_WINDOW_DAYS} days. Approve a request so they can send it back, then refund once the items arrive with you.`}
      />
      <FilterTabs<Filter>
        label="Filter returns"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: 'Open', count: count('open') },
          { value: 'requested', label: 'Requested', count: count('requested') },
          { value: 'approved', label: 'Awaiting items', count: count('approved') },
          { value: 'refunded', label: 'Refunded', count: count('refunded') },
          { value: 'rejected', label: 'Rejected', count: count('rejected') },
          { value: 'all', label: 'All', count: returns.data.length },
        ]}
      />
      {returns.error ? <ErrorText>{returns.error}</ErrorText> : returns.loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No returns here" body={filter === 'open' ? 'Nothing needs your attention.' : 'Try another filter.'} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-4 py-5 md:grid-cols-[1fr_auto]">
              <div className="min-w-0 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/vendor/orders/${r.vendorOrderId}`} className="font-medium underline-offset-4 hover:underline">Order {r.orderNumber}</Link>
                  <StatusBadge status={r.status} label={r.status === 'approved' ? 'Awaiting items' : undefined} />
                  <span className="text-muted">Requested {formatDate(r.createdAt)}</span>
                </div>
                <ul className="text-ink-2">
                  {r.lines.map((l) => (
                    <li key={l.sku}>{l.quantity} × {l.title}, size {l.size} <span className="text-muted">({formatMoney(l.unitPrice)} each)</span></li>
                  ))}
                </ul>
                <p><span className="text-muted">Reason:</span> {r.reason}</p>
                {r.note ? <p><span className="text-muted">Your note:</span> {r.note}</p> : null}
                <p><span className="text-muted">Refund due:</span> <span className="font-medium">{formatMoney(r.refundAmount)}</span></p>
              </div>
              <div className="flex flex-wrap items-start gap-2 md:justify-end">
                {r.status === 'requested' ? (
                  <>
                    <button type="button" className={`${btnSm} btn-primary`} onClick={() => setPending({ kind: 'approve', ret: r })}>Approve</button>
                    <button type="button" className={`${btnSm} btn-secondary`} onClick={() => setPending({ kind: 'reject', ret: r })}>Reject</button>
                  </>
                ) : r.status === 'approved' ? (
                  <button type="button" className={`${btnSm} btn-primary`} onClick={() => setPending({ kind: 'refund', ret: r })}>
                    Refund {formatMoney(r.refundAmount)}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending?.kind === 'approve'}
        title="Approve this return?"
        body="We'll email the customer to send the items back to you. Refund them once the items arrive."
        confirmLabel="Approve"
        note={{ label: 'Note to the customer', placeholder: 'e.g. Please include the order number in the parcel.' }}
        onClose={() => setPending(null)}
        onConfirm={async (note) => {
          if (pending) await vendorApi({ action: 'reviewReturn', data: { returnId: pending.ret.id, approve: true, note } });
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'reject'}
        title="Reject this return?"
        body="Tell the customer why. They will see your note in the email we send."
        confirmLabel="Reject"
        danger
        note={{ label: 'Reason', required: true, placeholder: 'e.g. The item was returned worn.' }}
        onClose={() => setPending(null)}
        onConfirm={async (note) => {
          if (pending) await vendorApi({ action: 'reviewReturn', data: { returnId: pending.ret.id, approve: false, note } });
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'refund'}
        title={`Refund ${pending ? formatMoney(pending.ret.refundAmount) : ''}?`}
        body="Only refund once the items have arrived back with you. The money goes back to the customer's card and comes out of your payout for this order."
        confirmLabel="Refund"
        danger
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await vendorApi({ action: 'refundReturn', data: { returnId: pending.ret.id } });
        }}
      />
    </>
  );
}

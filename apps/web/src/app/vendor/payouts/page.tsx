'use client';

import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatMoney, type VendorOrder, type VendorPrivate } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { bpsToPercent, formatDate } from '@/components/dashboard/format';
import { useAction, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { DataTable, EmptyState, ErrorText, KeyValue, Loading, PageHeader, Panel, Stat, StatusBadge } from '@/components/dashboard/ui';
import { vendorApi } from '@/lib/firebase/api';
import { Notice } from '@/components/ui';

function stripeState(p: VendorPrivate | null) {
  if (!p?.stripeAccountId) return { label: 'Not set up', tone: 'neutral' as const, body: 'Connect a bank account through Stripe so we can pay you for every order you ship.' };
  if (!p.detailsSubmitted) return { label: 'Unfinished', tone: 'warn' as const, body: 'You started setting up payouts but Stripe still needs a few details from you.' };
  if (!p.payoutsEnabled || !p.chargesEnabled) return { label: 'Under review', tone: 'warn' as const, body: 'Stripe is verifying your details. This usually takes a day or two; this page updates on its own.' };
  return { label: 'Active', tone: 'good' as const, body: 'You are all set. We transfer your net amount for each order as soon as you mark it as shipped.' };
}

export default function VendorPayoutsPage() {
  const { vendorId, vendorRole } = useDashboard();
  const params = useSearchParams();
  const priv = useLiveDoc<VendorPrivate>(`vendorPrivate:${vendorId}`, (db) => doc(db, 'vendorPrivate', vendorId));
  const orders = useLiveQuery<VendorOrder>(`payouts:${vendorId}`, (db) =>
    query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc'), limit(200)));
  const link = useAction();

  const go = (kind: 'onboardingLink' | 'dashboardLink') =>
    link.run(async () => {
      const res = (await vendorApi({ action: kind, data: {} })) as { url: string };
      window.location.assign(res.url);
    });

  if (priv.loading) return <Loading />;
  const p = priv.data;
  const state = stripeState(p);
  const owner = vendorRole === 'owner';
  const paidOrders = orders.data.filter((o) => o.status !== 'awaiting_payment' && o.status !== 'cancelled');
  const sum = (status: string) => paidOrders.filter((o) => o.payout.status === status).reduce((n, o) => n + o.payout.amount, 0);

  return (
    <>
      <PageHeader eyebrow="Money" title="Payouts" description="DOLGERS takes payment from the shopper and pays your share to your bank through Stripe." />

      {params.get('return') ? (
        <div className="mb-6">
          <Notice tone="success">Welcome back. Stripe is checking what you entered; your status below updates automatically.</Notice>
        </div>
      ) : null}
      {params.get('refresh') ? (
        <div className="mb-6">
          <Notice>That Stripe link expired before you finished. Pick up where you left off with the button below.</Notice>
        </div>
      ) : null}
      {priv.error ? <div className="mb-6"><ErrorText>{priv.error}</ErrorText></div> : null}

      <Panel title="Stripe account" actions={<StatusBadge status={state.tone === 'good' ? 'active' : 'pending'} label={state.label} tone={state.tone} />}>
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
          <div className="space-y-4">
            <p className="text-sm text-ink-2">{state.body}</p>
            <KeyValue
              items={[
                ['Details submitted', p?.detailsSubmitted ? 'Yes' : 'No'],
                ['Can accept orders', p?.chargesEnabled ? 'Yes' : 'Not yet'],
                ['Payouts to your bank', p?.payoutsEnabled ? 'Enabled' : 'Not yet'],
                ['DOLGERS commission', p ? `${bpsToPercent(p.commissionBps)}% of each sale` : '—'],
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 md:min-w-[220px]">
            {state.tone !== 'good' ? (
              <button type="button" className="btn btn-primary" disabled={!owner || link.pending} onClick={() => void go('onboardingLink')}>
                {link.pending ? 'Opening Stripe…' : p?.stripeAccountId ? 'Continue setup' : 'Set up payouts'}
              </button>
            ) : null}
            {p?.detailsSubmitted ? (
              <button type="button" className="btn btn-secondary" disabled={link.pending} onClick={() => void go('dashboardLink')}>
                Open Stripe dashboard
              </button>
            ) : null}
            {!owner ? <p className="text-xs text-muted">Only the store owner can change payout details.</p> : null}
          </div>
        </div>
        {link.error ? <div className="mt-4"><ErrorText>{link.error}</ErrorText></div> : null}
      </Panel>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Paid out" value={formatMoney(sum('paid'))} hint="Transferred to Stripe" />
        <Stat label="Pending" value={formatMoney(sum('pending'))} hint="Paid when the order ships" />
        <Stat label="On hold" value={formatMoney(sum('blocked'))} hint={sum('blocked') ? 'Finish Stripe setup to release' : 'Nothing on hold'} />
      </div>

      <section className="mt-12">
        <h2 className="label mb-4">Payouts by order</h2>
        {orders.error ? <ErrorText>{orders.error}</ErrorText> : orders.loading ? <Loading /> : paidOrders.length === 0 ? (
          <EmptyState title="No payouts yet" body="Each order you ship shows up here with what you were paid." />
        ) : (
          <DataTable
            caption="Payouts by order"
            rows={paidOrders}
            rowKey={(o) => o.id}
            columns={[
              { header: 'Order', cell: (o) => <Link href={`/vendor/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.orderNumber}</Link> },
              { header: 'Placed', cell: (o) => formatDate(o.createdAt) },
              { header: 'Subtotal', align: 'right', cell: (o) => formatMoney(o.subtotal) },
              { header: 'Commission', align: 'right', cell: (o) => formatMoney(o.commission) },
              { header: 'Refunded', align: 'right', cell: (o) => (o.refunded ? formatMoney(o.refunded) : '—') },
              { header: 'Payout', align: 'right', cell: (o) => formatMoney(o.payout.amount) },
              { header: 'Status', cell: (o) => <StatusBadge status={o.payout.status} /> },
              { header: 'Paid', cell: (o) => formatDate(o.payout.paidAt) },
            ]}
          />
        )}
      </section>
    </>
  );
}

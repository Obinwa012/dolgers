'use client';

import { collection, doc, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { DELIVERY, formatMoney, type ReturnRequest, type VendorOrder } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { formatDate, formatDateTime } from '@/components/dashboard/format';
import { useAction, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { OrderLines, AddressBlock, MoneySummary } from '@/components/dashboard/OrderParts';
import { ErrorText, Field, KeyValue, Loading, PageHeader, Panel, StatusBadge, SuccessText } from '@/components/dashboard/ui';
import { vendorApi } from '@/lib/firebase/api';

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL Express'];

function ShipForm({ order }: { order: VendorOrder }) {
  const [carrier, setCarrier] = useState(order.tracking?.carrier ?? '');
  const [number, setNumber] = useState(order.tracking?.number ?? '');
  const [url, setUrl] = useState(order.tracking?.url ?? '');
  const action = useAction();
  const first = order.status === 'preparing';

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (url && !url.startsWith('https://')) {
          action.setError('The tracking link must start with https://');
          return;
        }
        void action.run(
          () => vendorApi({ action: 'markShipped', data: { vendorOrderId: order.id, carrier: carrier.trim(), number: number.trim(), url: url.trim() } }),
          first ? 'Marked as shipped. We have emailed the customer their tracking details.' : 'Tracking updated.',
        );
      }}
    >
      <Field id="carrier" label="Carrier">
        <input id="carrier" className="field" list="carriers" required maxLength={40} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        <datalist id="carriers">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field id="tracking" label="Tracking number">
        <input id="tracking" className="field" required maxLength={60} value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field id="trackingUrl" label="Tracking link (optional)" hint="We'll include it in the shipping email.">
        <input id="trackingUrl" type="url" className="field" maxLength={500} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <ErrorText>{action.error}</ErrorText>
      <SuccessText>{action.success}</SuccessText>
      <button type="submit" className="btn btn-primary w-full" disabled={action.pending || !carrier.trim() || !number.trim()}>
        {action.pending ? 'Saving…' : first ? 'Mark as shipped' : 'Update tracking'}
      </button>
    </form>
  );
}

export default function VendorOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { vendorId } = useDashboard();
  const order = useLiveDoc<VendorOrder>(`vendorOrder:${id}`, (db) => doc(db, 'vendorOrders', id));
  const returns = useLiveQuery<ReturnRequest>(`orderReturns:${id}`, (db) =>
    query(collection(db, 'returns'), where('vendorId', '==', vendorId), where('vendorOrderId', '==', id)));

  if (order.loading) return <Loading />;
  if (order.error || !order.data) {
    return (
      <>
        <PageHeader title="Order" back={{ label: 'Orders', href: '/vendor/orders' }} />
        <ErrorText>{order.error ?? 'We could not find that order.'}</ErrorText>
      </>
    );
  }
  const o = order.data;

  return (
    <>
      <PageHeader
        back={{ label: 'Orders', href: '/vendor/orders' }}
        eyebrow={`Placed ${formatDateTime(o.createdAt)}`}
        title={`Order ${o.orderNumber}`}
        description={<span className="flex flex-wrap items-center gap-3"><StatusBadge status={o.status} /> <span>{DELIVERY[o.delivery].label} delivery</span></span>}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <Panel title="Items">
            <OrderLines lines={o.lines} />
          </Panel>
          <Panel title="Money">
            <MoneySummary
              rows={[
                ['Items subtotal', formatMoney(o.subtotal)],
                ['Your share of discounts', o.discountShare ? `−${formatMoney(o.discountShare)}` : formatMoney(0)],
                ['DOLGERS commission', `−${formatMoney(o.commission)}`],
                ...(o.refunded ? [['Refunded to customer', `−${formatMoney(o.refunded)}`] as [string, string]] : []),
              ]}
              total={['Your net', formatMoney(o.vendorNet)]}
            />
            <div className="mt-5 border-t border-line pt-4">
              <KeyValue
                items={[
                  ['Payout', <StatusBadge key="p" status={o.payout.status} />],
                  ['Payout amount', formatMoney(o.payout.amount)],
                  ['Paid on', formatDate(o.payout.paidAt)],
                ]}
              />
              {o.payout.status === 'blocked' ? (
                <p className="mt-3 text-sm text-danger">
                  This payout is on hold until your Stripe account can receive transfers. <Link href="/vendor/payouts" className="underline">Check payouts</Link>.
                </p>
              ) : null}
            </div>
          </Panel>
          {returns.data.length ? (
            <Panel title="Returns">
              <ul className="space-y-2 text-sm">
                {returns.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={r.status} />
                    <span>{r.lines.map((l) => `${l.quantity} × ${l.title} (${l.size})`).join(', ')}</span>
                    <Link href="/vendor/returns" className="underline underline-offset-4">Manage</Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
        <div className="space-y-8">
          <Panel title="Ship to">
            <AddressBlock address={o.shippingAddress} />
            <p className="mt-3 text-sm text-muted">{o.email}</p>
            <p className="mt-3 text-sm"><span className="font-medium">{DELIVERY[o.delivery].label}:</span> {DELIVERY[o.delivery].detail}</p>
            {o.estimatedDelivery ? (
              <p className="mt-1 text-sm text-muted">Expected {formatDate(o.estimatedDelivery.from)} – {formatDate(o.estimatedDelivery.to)}</p>
            ) : null}
          </Panel>
          {o.status === 'preparing' || o.status === 'shipped' ? (
            <Panel title={o.status === 'preparing' ? 'Mark as shipped' : 'Tracking'}>
              {o.status === 'shipped' && o.shippedAt ? <p className="mb-4 text-sm text-muted">Shipped {formatDateTime(o.shippedAt)}</p> : null}
              <ShipForm key={o.tracking?.number ?? 'new'} order={o} />
            </Panel>
          ) : o.tracking ? (
            <Panel title="Tracking">
              <KeyValue items={[['Carrier', o.tracking.carrier], ['Number', o.tracking.number], ['Shipped', formatDateTime(o.shippedAt)]]} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

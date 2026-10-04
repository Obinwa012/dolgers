'use client';

import { collection, doc, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { DELIVERY, formatMoney, type Order, type VendorOrder } from '@dolgers/shared';
import { formatDateTime, parseDollars } from '@/components/dashboard/format';
import { useAction, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { MoneyInput } from '@/components/dashboard/MoneyInput';
import { AddressBlock, MoneySummary, OrderLines } from '@/components/dashboard/OrderParts';
import { ErrorText, Field, KeyValue, Loading, PageHeader, Panel, StatusBadge, SuccessText, btnSm } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

function RefundForm({ vo }: { vo: VendorOrder }) {
  const refundable = vo.subtotal - vo.discountShare - vo.refunded;
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const action = useAction();
  const cents = parseDollars(amount);
  const prefix = `refund-${vo.id}`;

  if (refundable <= 0) return <p className="text-sm text-muted">Fully refunded.</p>;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents === null || cents < 1) return action.setError('Enter an amount to refund.');
        if (cents > refundable) return action.setError(`At most ${formatMoney(refundable)} can be refunded here.`);
        if (!reason.trim()) return action.setError('Give a reason for the refund.');
        if (!confirming) {
          action.reset();
          setConfirming(true);
          return;
        }
        void action.run(async () => {
          await adminApi({ action: 'refund', data: { vendorOrderId: vo.id, amount: cents, reason: reason.trim() } });
          setAmount('');
          setReason('');
          setConfirming(false);
        }, `Refunded ${formatMoney(cents)}. The customer has been emailed.`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field id={`${prefix}-amount`} label={`Amount (max ${formatMoney(refundable)})`}>
          <MoneyInput id={`${prefix}-amount`} value={amount} onChange={(v) => { setAmount(v); setConfirming(false); }} />
        </Field>
        <Field id={`${prefix}-reason`} label="Reason">
          <input id={`${prefix}-reason`} className="field" maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setConfirming(false); }} placeholder="e.g. Item arrived damaged" />
        </Field>
      </div>
      <ErrorText>{action.error}</ErrorText>
      <SuccessText>{action.success}</SuccessText>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={`${btnSm} ${confirming ? 'border border-danger bg-danger text-paper' : 'btn-secondary'}`} disabled={action.pending}>
          {action.pending ? 'Refunding…' : confirming && cents ? `Confirm refund of ${formatMoney(cents)}` : 'Refund'}
        </button>
        <button type="button" className="label text-muted hover:text-ink" onClick={() => { setAmount(String(refundable / 100)); setConfirming(false); }}>
          Full amount
        </button>
        {confirming ? <button type="button" className="label text-muted hover:text-ink" onClick={() => setConfirming(false)}>Cancel</button> : null}
      </div>
      {confirming ? <p className="text-xs text-muted">Money goes back to the customer&apos;s card. If the maker was already paid, the matching share is taken back from their transfer.</p> : null}
    </form>
  );
}

function VendorOrderPanel({ vo }: { vo: VendorOrder }) {
  const retry = useAction();
  return (
    <Panel
      title={vo.vendorName}
      actions={<StatusBadge status={vo.status} />}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <OrderLines lines={vo.lines} />
        <div className="space-y-4">
          <MoneySummary
            rows={[
              ['Subtotal', formatMoney(vo.subtotal)],
              ['Discount share', vo.discountShare ? `−${formatMoney(vo.discountShare)}` : formatMoney(0)],
              ['Commission', formatMoney(vo.commission)],
              ['Refunded', vo.refunded ? formatMoney(vo.refunded) : '—'],
            ]}
            total={['Vendor net', formatMoney(vo.vendorNet)]}
          />
          <KeyValue
            items={[
              ['Vendor', <Link key="v" href={`/admin/vendors/${vo.vendorId}`} className="underline underline-offset-4">{vo.vendorName}</Link>],
              ['Payout', <StatusBadge key="p" status={vo.payout.status} />],
              ['Payout amount', formatMoney(vo.payout.amount)],
              ['Transfer', vo.payout.transferId ? <code key="t" className="text-xs">{vo.payout.transferId}</code> : '—'],
              ['Tracking', vo.tracking ? `${vo.tracking.carrier} ${vo.tracking.number}` : '—'],
              ['Shipped', formatDateTime(vo.shippedAt)],
            ]}
          />
          {vo.payout.status === 'blocked' ? (
            <div className="space-y-2">
              <button type="button" className={`${btnSm} btn-primary`} disabled={retry.pending}
                onClick={() => void retry.run(async () => {
                  const res = (await adminApi({ action: 'retryPayout', data: { vendorOrderId: vo.id } })) as { status: string };
                  return res.status;
                }, (s) => (s === 'paid' ? 'Payout sent.' : 'Still on hold: the vendor has not finished Stripe setup.'))}>
                {retry.pending ? 'Retrying…' : 'Retry payout'}
              </button>
              <ErrorText>{retry.error}</ErrorText>
              <SuccessText>{retry.success}</SuccessText>
            </div>
          ) : null}
        </div>
      </div>
      {vo.status !== 'awaiting_payment' && vo.status !== 'cancelled' ? (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="label mb-3 text-muted">Refund</h3>
          <RefundForm vo={vo} />
        </div>
      ) : null}
    </Panel>
  );
}

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useLiveDoc<Order>(`order:${id}`, (db) => doc(db, 'orders', id));
  const parts = useLiveQuery<VendorOrder>(`orderParts:${id}`, (db) => query(collection(db, 'vendorOrders'), where('orderId', '==', id)));

  if (order.loading) return <Loading />;
  if (order.error || !order.data) {
    return (
      <>
        <PageHeader title="Order" back={{ label: 'Orders', href: '/admin/orders' }} />
        <ErrorText>{order.error ?? 'Order not found.'}</ErrorText>
      </>
    );
  }
  const o = order.data;

  return (
    <>
      <PageHeader
        back={{ label: 'Orders', href: '/admin/orders' }}
        eyebrow={`Placed ${formatDateTime(o.createdAt)}`}
        title={`Order ${o.number}`}
        description={<span className="flex flex-wrap items-center gap-3"><StatusBadge status={o.status} /> {o.email}{o.isGuest ? ' (guest)' : ''}</span>}
      />
      <div className="grid gap-8 lg:grid-cols-3">
        <Panel title="Totals">
          <MoneySummary
            rows={[
              ['Subtotal', formatMoney(o.totals.subtotal)],
              ['Discount', o.totals.discount ? `−${formatMoney(o.totals.discount)}` : formatMoney(0)],
              ['Shipping', formatMoney(o.totals.shipping)],
              ['Tax', formatMoney(o.totals.tax)],
            ]}
            total={['Total', formatMoney(o.totals.total)]}
          />
          {o.refundedTotal ? <p className="mt-3 text-sm text-danger">Refunded {formatMoney(o.refundedTotal)}</p> : null}
        </Panel>
        <Panel title="Ship to">
          <AddressBlock address={o.shippingAddress} />
          <p className="mt-3 text-sm">{DELIVERY[o.delivery].label} · {DELIVERY[o.delivery].detail}</p>
        </Panel>
        <Panel title="Payment">
          <KeyValue
            items={[
              ['Paid', formatDateTime(o.paidAt)],
              ['Method', o.paymentMethodSummary ?? '—'],
              ['Promo code', o.promoCode ?? '—'],
              ['Payment', o.paymentIntentId ? <code key="pi" className="break-all text-xs">{o.paymentIntentId}</code> : '—'],
              ['Customer', o.uid ? <code key="u" className="break-all text-xs">{o.uid}</code> : '—'],
            ]}
          />
        </Panel>
      </div>
      <section className="mt-10 space-y-6">
        <h2 className="label">By maker</h2>
        {parts.error ? <ErrorText>{parts.error}</ErrorText> : parts.loading ? <Loading /> : parts.data.length === 0 ? (
          <p className="text-sm text-muted">This order has not been split by maker yet. That happens once payment succeeds.</p>
        ) : (
          parts.data.map((vo) => <VendorOrderPanel key={vo.id} vo={vo} />)
        )}
      </section>
    </>
  );
}

'use client';

import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney, type Order, type ReturnRequest, type VendorOrder } from '@dolgers/shared';
import { Notice, Spinner } from '@/components/ui';
import { deliveryPrice, formatDate, fullName, groupByVendor, paymentLabel, stateName } from '@/components/checkout/format';
import { TotalsRows } from '@/components/checkout/OrderSummary';
import { ShipmentCard } from '@/components/checkout/ShipmentCard';
import { useAuth } from '@/context/AuthProvider';
import { firebase } from '@/lib/firebase/client';
import { ReturnRequestForm } from './ReturnRequestForm';
import { ORDER_STATUS, RETURN_STATUS } from './status';

export function OrderDetailView() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const uid = user?.uid;
  const [load, setLoad] = useState<{ id: string; order: Order | null; failed: boolean } | null>(null);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);

  useEffect(() => {
    const fb = firebase();
    if (!fb || !uid) return;
    const unsubs = [
      onSnapshot(
        doc(fb.db, 'orders', orderId),
        (snap) => setLoad({ id: orderId, order: snap.exists() ? (snap.data() as Order) : null, failed: !snap.exists() }),
        () => setLoad({ id: orderId, order: null, failed: true }),
      ),
      onSnapshot(
        query(collection(fb.db, 'vendorOrders'), where('uid', '==', uid), where('orderId', '==', orderId)),
        (snap) => setVendorOrders(snap.docs.map((d) => d.data() as VendorOrder)),
        () => undefined,
      ),
      onSnapshot(
        query(collection(fb.db, 'returns'), where('uid', '==', uid), where('orderId', '==', orderId)),
        (snap) => setReturns(snap.docs.map((d) => d.data() as ReturnRequest).sort((a, b) => b.createdAt - a.createdAt)),
        () => undefined,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, orderId]);

  const order = load?.id === orderId ? load.order : null;
  const parcels = useMemo(() => {
    if (!order) return [];
    const byVendor = new Map(vendorOrders.filter((v) => v.orderId === order.id).map((v) => [v.vendorId, v]));
    return groupByVendor(order.lines).map((g) => ({ ...g, vo: byVendor.get(g.vendorId) ?? null }));
  }, [order, vendorOrders]);

  if (!load || load.id !== orderId) return <Spinner label="Loading your order" />;
  if (!order) {
    return (
      <div>
        <h1 className="display text-[36px]">Order not found</h1>
        <p className="mt-4 text-sm text-muted">This order is not linked to your account. If you checked out as a guest, your receipt email has every detail.</p>
        <Link href="/account/orders" className="link-underline mt-8 inline-block">Back to orders</Link>
      </div>
    );
  }

  const t = order.totals;
  const a = order.shippingAddress;

  return (
    <div>
      <Link href="/account/orders" className="text-xs text-muted hover:text-ink">← All orders</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-muted">Order {order.number}</p>
          <h1 className="display mt-3 text-[34px] md:text-[44px]">{ORDER_STATUS[order.status]}</h1>
        </div>
        <p className="text-sm text-muted">Placed {formatDate(order.createdAt)}</p>
      </div>

      {order.status === 'pending_payment' ? (
        <div className="mt-6"><Notice>We are still confirming the payment for this order.</Notice></div>
      ) : null}

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {parcels.map((p) => {
            const vo = p.vo;
            const voReturns = vo ? returns.filter((r) => r.vendorOrderId === vo.id) : [];
            // Show review links if order is shipped (delivery confirmed via tracking)
            const showReviews = order.status === 'shipped' || order.status === 'partially_shipped' || vo?.status === 'shipped';
            return (
              <ShipmentCard
                key={p.vendorId}
                vendorName={p.vendorName}
                status={vo?.status ?? (order.paidAt ? 'preparing' : 'awaiting_payment')}
                lines={vo?.lines ?? p.lines}
                estimatedDelivery={vo?.estimatedDelivery ?? null}
                tracking={vo?.tracking ?? null}
                reviewLinks={showReviews ? { orderId: order.id, email: order.email } : null}
              >
                {voReturns.length ? (
                  <ul className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
                    {voReturns.map((r) => (
                      <li key={r.id}>
                        <p className="font-medium">{RETURN_STATUS[r.status]} · {formatDate(r.createdAt)}</p>
                        <p className="mt-1 text-xs text-muted">
                          {r.lines.map((l) => `${l.title} (${l.size}) × ${l.quantity}`).join(', ')}
                          {r.status === 'refunded' || r.status === 'approved' ? ` · Refund ${formatMoney(r.refundAmount)}` : ''}
                        </p>
                        {r.note ? <p className="mt-1 text-xs text-ink-2">Note from {p.vendorName}: {r.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {vo ? <ReturnRequestForm vo={vo} returns={voReturns} /> : null}
              </ShipmentCard>
            );
          })}
        </div>

        <aside className="space-y-8 self-start">
          <div className="bg-stone p-7">
            <h2 className="display text-[24px]">Summary</h2>
            <div className="mt-5">
              <TotalsRows
                rows={[
                  { label: 'Subtotal', value: formatMoney(t.subtotal) },
                  ...(t.discount > 0 ? [{ label: order.promoCode ? `Promo ${order.promoCode}` : 'Discount', value: `−${formatMoney(t.discount)}` }] : []),
                  { label: 'Delivery', value: deliveryPrice(t.shipping) },
                  { label: 'Tax', value: formatMoney(t.tax) },
                  ...(order.refundedTotal > 0 ? [{ label: 'Refunded', value: `−${formatMoney(order.refundedTotal)}` }] : []),
                ]}
                total={{ label: 'Total paid', value: formatMoney(t.total) }}
              />
            </div>
          </div>
          <div className="text-sm">
            <h2 className="label">Delivering to</h2>
            <address className="mt-2 not-italic leading-relaxed text-ink-2">
              {fullName(a)}<br />
              {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
              {a.city}, {stateName(a.state)} {a.postalCode}
            </address>
          </div>
          {order.paidAt ? (
            <div className="text-sm">
              <h2 className="label">Paid with</h2>
              <p className="mt-2 text-ink-2">{paymentLabel(order.paymentMethodSummary)}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted">
            Questions about this order? <Link href="/help/contact" className="underline underline-offset-2">Contact us</Link> and quote {order.number}.
          </p>
        </aside>
      </div>
    </div>
  );
}

// Order lifecycle: finalize after payment, release stock holds, pay vendors, refund.
// Every function here is idempotent: Stripe retries webhooks and buyers double-click.
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type Stripe from 'stripe';
import {
  DEFAULT_COMMISSION_BPS,
  formatMoney,
  vendorSettlement,
  type InventoryRecord,
  type Order,
  type VendorOrder,
  type VendorPrivate,
} from '@dolgers/shared';
import { audit } from './audit.ts';
import { db, now } from './firebase.ts';
import { ledger } from './ledger.ts';
import { queueMail } from './mail.ts';
import { stripe } from './stripe.ts';

const DAY = 86_400_000;

export const vendorOrderId = (orderId: string, vendorId: string) => `${orderId}_${vendorId}`;

/** Adds a working-day count to a date, skipping weekends. */
function addWorkingDays(from: number, days: number): number {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d.getTime();
}

/** Moves reserved units back to sellable stock. Call inside a transaction after reading `order`. */
function releaseInTx(tx: Transaction, order: Order, invSnaps: Map<string, InventoryRecord>) {
  if (!order.reservationHeld) return;
  for (const line of order.lines) {
    const inv = invSnaps.get(line.sku);
    if (!inv) continue;
    tx.update(db.collection('inventory').doc(line.sku), {
      reserved: Math.max(0, inv.reserved - line.quantity),
      updatedAt: now(),
    });
  }
}

async function readInventory(tx: Transaction, order: Order) {
  const refs = order.lines.map((l) => db.collection('inventory').doc(l.sku));
  const snaps = refs.length ? await tx.getAll(...refs) : [];
  const map = new Map<string, InventoryRecord>();
  for (const s of snaps) if (s.exists) map.set(s.id, s.data() as InventoryRecord);
  return map;
}

/** Cancels an unpaid order and frees its stock. No-op unless the order is still pending. */
export async function cancelPendingOrder(orderId: string, reason: string): Promise<boolean> {
  const ref = db.collection('orders').doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order || order.status !== 'pending_payment') return false;
    const inv = await readInventory(tx, order);
    releaseInTx(tx, order, inv);
    tx.update(ref, { status: 'cancelled', reservationHeld: false, cancelReason: reason });
    return true;
  });
}

/**
 * Marks an order paid after Stripe confirms the money arrived: commits stock, splits the order
 * into one vendor order per maker, records the ledger and queues emails.
 */
export async function finalizePaidOrder(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) {
    logger.warn('payment intent without orderId', { pi: pi.id });
    return;
  }
  const ref = db.collection('orders').doc(orderId);
  const charge = typeof pi.latest_charge === 'string' ? await stripe().charges.retrieve(pi.latest_charge) : pi.latest_charge;
  const card = charge?.payment_method_details?.card;
  const paymentMethodSummary = card ? `${(card.brand ?? 'card').toUpperCase()} ending ${card.last4}` : (charge?.payment_method_details?.type ?? null);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order) return { kind: 'missing' as const };
    if (order.status !== 'pending_payment' && order.status !== 'cancelled') return { kind: 'done' as const };
    if (order.paidAt) return { kind: 'done' as const };
    if (pi.amount_received !== order.totals.total || pi.currency !== order.currency) {
      return { kind: 'mismatch' as const, order };
    }

    const inv = await readInventory(tx, order);
    // A late payment on an order whose hold already expired: take stock only if it is still there.
    if (!order.reservationHeld) {
      for (const line of order.lines) {
        const i = inv.get(line.sku);
        if (!i || i.onHand - i.reserved < line.quantity) return { kind: 'oversold' as const, order };
      }
    }

    const privSnaps = await tx.getAll(...order.vendorIds.map((v) => db.collection('vendorPrivate').doc(v)));
    const commissionByVendor = new Map(privSnaps.map((s) => [s.id, (s.data() as VendorPrivate | undefined)?.commissionBps ?? DEFAULT_COMMISSION_BPS]));
    const contactByVendor = new Map(privSnaps.map((s) => [s.id, (s.data() as VendorPrivate | undefined)?.contactEmail ?? '']));
    const vendorSnaps = await tx.getAll(...order.vendorIds.map((v) => db.collection('vendors').doc(v)));
    const dispatchByVendor = new Map(vendorSnaps.map((s) => [s.id, (s.data()?.facts?.dispatchDays as [number, number] | undefined) ?? [2, 5]]));

    // All reads are done; writes follow.
    for (const line of order.lines) {
      const i = inv.get(line.sku);
      if (!i) continue;
      tx.update(db.collection('inventory').doc(line.sku), {
        onHand: Math.max(0, i.onHand - line.quantity),
        reserved: order.reservationHeld ? Math.max(0, i.reserved - line.quantity) : i.reserved,
        updatedAt: now(),
      });
    }

    const t = now();
    const discountShares = order.vendorDiscounts ?? {};
    for (const vendorId of order.vendorIds) {
      const lines = order.lines.filter((l) => l.vendorId === vendorId);
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const discountShare = discountShares[vendorId] ?? 0;
      const { commission, vendorNet } = vendorSettlement(subtotal, discountShare, commissionByVendor.get(vendorId)!);
      const [dMin, dMax] = dispatchByVendor.get(vendorId)!;
      const transit = order.delivery === 'express' ? [1, 2] : [3, 5];
      const vo: VendorOrder = {
        id: vendorOrderId(order.id, vendorId),
        orderId: order.id,
        orderNumber: order.number,
        vendorId,
        vendorName: lines[0].vendorName,
        uid: order.uid,
        email: order.email,
        lines,
        shippingAddress: order.shippingAddress,
        delivery: order.delivery,
        subtotal,
        discountShare,
        commission,
        vendorNet,
        refunded: 0,
        status: 'preparing',
        tracking: null,
        shippedAt: null,
        estimatedDelivery: { from: addWorkingDays(t, dMin + transit[0]), to: addWorkingDays(t, dMax + transit[1]) },
        payout: { status: 'pending', amount: vendorNet, transferId: null, paidAt: null },
        createdAt: t,
      };
      tx.set(db.collection('vendorOrders').doc(vo.id), vo);
      ledger({ type: 'commission', amount: commission, orderId: order.id, vendorId, stripeId: null, note: `Commission on ${order.number}` }, tx);
      const contact = contactByVendor.get(vendorId);
      if (contact) {
        queueMail(contact, `New DOLGERS order ${order.number}`,
          `You have a new order (${order.number}) with ${lines.length} item(s), ${formatMoney(subtotal)} before commission.\n` +
          `Please ship within your stated dispatch time and add tracking in your vendor dashboard.`, tx);
      }
    }

    ledger({ type: 'charge', amount: pi.amount_received, orderId: order.id, vendorId: null, stripeId: pi.id, note: `Payment for ${order.number}` }, tx);
    if (order.promoCode) tx.set(db.collection('promoCodes').doc(order.promoCode), { redemptions: FieldValue.increment(1) }, { merge: true });

    tx.update(ref, {
      status: 'paid',
      paidAt: t,
      reservationHeld: false,
      chargeId: charge?.id ?? null,
      paymentMethodSummary,
    });
    queueMail(order.email, `Your DOLGERS order ${order.number} is confirmed`,
      `Thank you. Your order ${order.number} is confirmed, ${formatMoney(order.totals.total)} paid.\n` +
      `It ships in ${order.vendorIds.length} parcel(s), one from each maker. We'll email you as each one ships.`, tx);
    return { kind: 'paid' as const, order };
  });

  if (outcome.kind === 'mismatch') {
    logger.error('amount mismatch on payment', { orderId, pi: pi.id, received: pi.amount_received });
    await audit('system', 'payment.amount_mismatch', orderId, { pi: pi.id, received: pi.amount_received });
  } else if (outcome.kind === 'oversold') {
    // The hold expired and the stock sold to someone else. Refund in full and tell the buyer.
    await stripe().refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' }, { idempotencyKey: `oversold-${pi.id}` });
    await ref.update({ status: 'refunded', refundedTotal: pi.amount_received });
    await ledger({ type: 'refund', amount: pi.amount_received, orderId, vendorId: null, stripeId: pi.id, note: 'Stock sold out before payment completed' });
    await queueMail(outcome.order.email, `About your DOLGERS order ${outcome.order.number}`,
      'Your payment arrived after the items sold out, so we have refunded it in full. We are sorry for the trouble.');
  } else if (outcome.kind === 'paid' && outcome.order.taxCalculationId) {
    await stripe().tax.transactions
      .createFromCalculation({ calculation: outcome.order.taxCalculationId, reference: outcome.order.id }, { idempotencyKey: `tax-${outcome.order.id}` })
      .catch((err) => logger.error('tax transaction failed', { orderId, err: String(err) }));
  }
}

/** Sends a vendor its share once its parcel has shipped. Safe to call repeatedly. */
export async function payVendor(voId: string): Promise<VendorOrder['payout']['status']> {
  const voRef = db.collection('vendorOrders').doc(voId);
  const vo = (await voRef.get()).data() as VendorOrder | undefined;
  if (!vo) throw new Error(`vendor order ${voId} not found`);
  if (vo.payout.status === 'paid' || vo.payout.status === 'reversed') return vo.payout.status;
  if (vo.status !== 'shipped') return vo.payout.status;

  const priv = (await db.collection('vendorPrivate').doc(vo.vendorId).get()).data() as VendorPrivate | undefined;
  const order = (await db.collection('orders').doc(vo.orderId).get()).data() as Order;
  const amount = Math.max(0, vo.vendorNet - Math.round((vo.refunded * vo.vendorNet) / Math.max(1, vo.subtotal - vo.discountShare)));
  if (!priv?.stripeAccountId || !priv.payoutsEnabled) {
    await voRef.update({ 'payout.status': 'blocked', 'payout.amount': amount });
    return 'blocked';
  }
  if (amount === 0) {
    await voRef.update({ 'payout.status': 'paid', 'payout.amount': 0, 'payout.paidAt': now() });
    return 'paid';
  }
  const transfer = await stripe().transfers.create(
    {
      amount,
      currency: 'usd',
      destination: priv.stripeAccountId,
      transfer_group: vo.orderId,
      ...(order.chargeId ? { source_transaction: order.chargeId } : {}),
      metadata: { vendorOrderId: vo.id, orderId: vo.orderId, vendorId: vo.vendorId },
    },
    { idempotencyKey: `transfer-${vo.id}` },
  );
  await voRef.update({ 'payout.status': 'paid', 'payout.amount': amount, 'payout.transferId': transfer.id, 'payout.paidAt': now() });
  await ledger({ type: 'transfer', amount, orderId: vo.orderId, vendorId: vo.vendorId, stripeId: transfer.id, note: `Payout for ${vo.orderNumber}` });
  return 'paid';
}

/**
 * Refunds part or all of one vendor's share of an order. If the vendor was already paid, the
 * same proportion of their payout is reversed so the platform is not left out of pocket.
 */
export async function refundVendorOrder(voId: string, amount: number, reason: string, actorUid: string) {
  const voRef = db.collection('vendorOrders').doc(voId);
  const vo = (await voRef.get()).data() as VendorOrder | undefined;
  if (!vo) throw new Error('Vendor order not found.');
  const refundable = vo.subtotal - vo.discountShare - vo.refunded;
  if (amount > refundable) throw new Error(`At most ${formatMoney(refundable)} can be refunded on this part of the order.`);
  const orderRef = db.collection('orders').doc(vo.orderId);
  const order = (await orderRef.get()).data() as Order;

  const key = `refund-${vo.id}-${vo.refunded}-${amount}`;
  const refund = await stripe().refunds.create(
    { payment_intent: order.paymentIntentId, amount, metadata: { vendorOrderId: vo.id, reason: reason.slice(0, 200) } },
    { idempotencyKey: key },
  );

  let reversedId: string | null = null;
  let reversal = 0;
  if (vo.payout.status === 'paid' && vo.payout.transferId) {
    reversal = Math.min(vo.payout.amount, Math.round((amount * vo.vendorNet) / Math.max(1, vo.subtotal - vo.discountShare)));
    if (reversal > 0) {
      const r = await stripe().transfers.createReversal(vo.payout.transferId, { amount: reversal }, { idempotencyKey: `reversal-${key}` });
      reversedId = r.id;
    }
  }

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(voRef)).data() as VendorOrder;
    const freshOrder = (await tx.get(orderRef)).data() as Order;
    const refunded = fresh.refunded + amount;
    const fully = refunded >= fresh.subtotal - fresh.discountShare;
    tx.update(voRef, {
      refunded,
      status: fully ? 'refunded' : fresh.status,
      ...(reversal ? { 'payout.amount': fresh.payout.amount - reversal, ...(fully ? { 'payout.status': 'reversed' } : {}) } : {}),
    });
    const orderRefunded = (freshOrder.refundedTotal ?? 0) + amount;
    tx.update(orderRef, { refundedTotal: orderRefunded, status: orderRefunded >= freshOrder.totals.total - freshOrder.totals.shipping - freshOrder.totals.tax ? 'refunded' : 'partially_refunded' });
    ledger({ type: 'refund', amount, orderId: vo.orderId, vendorId: vo.vendorId, stripeId: refund.id, note: reason }, tx);
    if (reversedId) ledger({ type: 'transfer_reversal', amount: reversal, orderId: vo.orderId, vendorId: vo.vendorId, stripeId: reversedId, note: reason }, tx);
    queueMail(fresh.email, `Refund on DOLGERS order ${fresh.orderNumber}`,
      `We've refunded ${formatMoney(amount)} for items from ${fresh.vendorName}. It usually appears on your statement within 5 to 10 business days.`, tx);
  });
  await audit(actorUid, 'order.refund', vo.id, { amount, reason, refund: refund.id, reversal });
  return { refundId: refund.id, reversal };
}

export async function updateOrderShippingStatus(orderId: string) {
  const snaps = await db.collection('vendorOrders').where('orderId', '==', orderId).get();
  const statuses = snaps.docs.map((d) => (d.data() as VendorOrder).status);
  const shipped = statuses.filter((s) => s === 'shipped').length;
  const live = statuses.filter((s) => s !== 'cancelled' && s !== 'refunded').length;
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const order = (await tx.get(orderRef)).data() as Order;
    if (order.status !== 'paid' && order.status !== 'partially_shipped') return;
    tx.update(orderRef, { status: shipped >= live && live > 0 ? 'shipped' : shipped > 0 ? 'partially_shipped' : order.status });
  });
}

export const days = (n: number) => n * DAY;

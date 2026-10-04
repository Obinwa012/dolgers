import { randomBytes } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/https';
import { logger } from 'firebase-functions';
import {
  RESERVATION_MINUTES,
  createCheckoutSchema,
  priceCart,
  type InventoryRecord,
  type Order,
  type Product,
  type PromoCode,
} from '@dolgers/shared';
import { db, now } from './lib/firebase.ts';
import { parse, rateLimit, requireAuth } from './lib/guard.ts';
import { cancelPendingOrder } from './lib/orders.ts';
import { ENFORCE_APP_CHECK, REGION, STRIPE_SECRET_KEY, STRIPE_TAX_ENABLED } from './lib/params.ts';
import { stripe } from './lib/stripe.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function orderNumber(): string {
  const bytes = randomBytes(7);
  return 'DLG-' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * Step 2 of checkout ("Continue to payment"). Prices the bag from the database, holds the stock
 * for RESERVATION_MINUTES, creates the order and a Stripe PaymentIntent, and returns the client
 * secret for the embedded card form. The buyer's browser never sends a price.
 */
export const createCheckout = onCall(
  {
    region: REGION,
    secrets: [STRIPE_SECRET_KEY],
    enforceAppCheck: ENFORCE_APP_CHECK,
    maxInstances: 20,
    minInstances: 0,
    concurrency: 40,
    timeoutSeconds: 30,
  },
  async (req) => {
    const caller = requireAuth(req); // anonymous sign-in counts: guests check out too
    await rateLimit(`checkout:${caller.uid}`, 10, 600);
    const input = parse(createCheckoutSchema, req.data);

    if (input.replaceOrderId) {
      const prev = (await db.collection('orders').doc(input.replaceOrderId).get()).data() as Order | undefined;
      if (prev && prev.uid === caller.uid) {
        await cancelPendingOrder(prev.id, 'replaced');
        if (prev.paymentIntentId) await stripe().paymentIntents.cancel(prev.paymentIntentId).catch(() => undefined);
      }
    }

    const skus = [...new Set(input.lines.map((l) => l.sku))];
    const invRefs = skus.map((s) => db.collection('inventory').doc(s));

    // Preview pricing outside the transaction so tax can be calculated before stock is held.
    const preview = await loadAndPrice(skus, input, null);
    if (preview.priced.problems.length) {
      throw new HttpsError('failed-precondition', 'Some items in your bag are no longer available.', { problems: preview.priced.problems });
    }

    let tax = 0;
    let taxCalculationId: string | null = null;
    if (STRIPE_TAX_ENABLED.value() && preview.priced.totals.subtotal > 0) {
      const a = input.shippingAddress;
      const calc = await stripe().tax.calculations.create({
        currency: 'usd',
        customer_details: {
          address: { line1: a.line1, line2: a.line2 || undefined, city: a.city, state: a.state, postal_code: a.postalCode, country: 'US' },
          address_source: 'shipping',
        },
        line_items: preview.priced.lines.map((l, i) => ({
          amount: l.lineTotal - Math.round((preview.priced.totals.discount * l.lineTotal) / preview.priced.totals.subtotal),
          reference: `${l.sku}-${i}`,
          tax_behavior: 'exclusive' as const,
        })),
        shipping_cost: { amount: preview.priced.totals.shipping, tax_behavior: 'exclusive' },
      });
      tax = calc.tax_amount_exclusive;
      taxCalculationId = calc.id;
    }

    const orderRef = db.collection('orders').doc();
    const t = now();
    const order = await db.runTransaction(async (tx) => {
      const invSnaps = await tx.getAll(...invRefs);
      const productIds = [...new Set(invSnaps.filter((s) => s.exists).map((s) => (s.data() as InventoryRecord).productId))];
      const productSnaps = productIds.length ? await tx.getAll(...productIds.map((id) => db.collection('products').doc(id))) : [];
      const promo = input.promoCode ? await tx.get(db.collection('promoCodes').doc(input.promoCode.trim().toUpperCase())) : null;

      const stock = new Map<string, number>();
      for (const s of invSnaps) if (s.exists) { const d = s.data() as InventoryRecord; stock.set(s.id, d.onHand - d.reserved); }
      const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as Product]));
      const priced = priceCart({
        lines: input.lines, products, stock, delivery: input.delivery,
        promo: (promo?.data() as PromoCode | undefined) ?? null, promoCodeInput: input.promoCode, tax, now: t,
      });
      if (priced.problems.length) {
        throw new HttpsError('failed-precondition', 'Some items in your bag are no longer available.', { problems: priced.problems });
      }
      if (priced.totals.subtotal !== preview.priced.totals.subtotal || priced.totals.discount !== preview.priced.totals.discount) {
        throw new HttpsError('aborted', 'Prices changed while you were checking out. Please review your bag.');
      }

      for (const line of priced.lines) {
        const inv = invSnaps.find((s) => s.id === line.sku)!.data() as InventoryRecord;
        tx.update(db.collection('inventory').doc(line.sku), { reserved: inv.reserved + line.quantity, updatedAt: t });
      }

      const doc: Order = {
        id: orderRef.id,
        number: orderNumber(),
        uid: caller.uid,
        email: input.email.toLowerCase(),
        isGuest: caller.anonymous,
        lines: priced.lines,
        vendorIds: priced.vendors.map((v) => v.vendorId),
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        delivery: input.delivery,
        totals: priced.totals,
        vendorDiscounts: Object.fromEntries(priced.vendors.map((v) => [v.vendorId, v.discountShare])),
        currency: 'usd',
        promoCode: priced.promo?.applied ? priced.promo.code : null,
        paymentIntentId: '',
        chargeId: null,
        taxCalculationId,
        paymentMethodSummary: null,
        reservationHeld: true,
        status: 'pending_payment',
        refundedTotal: 0,
        reservationExpiresAt: t + RESERVATION_MINUTES * 60_000,
        marketingOptIn: input.marketingOptIn,
        createdAt: t,
        paidAt: null,
      };
      tx.set(orderRef, doc);
      return doc;
    });

    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount: order.totals.total,
          currency: 'usd',
          automatic_payment_methods: { enabled: true },
          receipt_email: order.email,
          transfer_group: order.id,
          description: `DOLGERS order ${order.number}`,
          metadata: { orderId: order.id, orderNumber: order.number, uid: caller.uid },
          shipping: {
            name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
            phone: order.shippingAddress.phone || undefined,
            address: {
              line1: order.shippingAddress.line1, line2: order.shippingAddress.line2 || undefined,
              city: order.shippingAddress.city, state: order.shippingAddress.state,
              postal_code: order.shippingAddress.postalCode, country: 'US',
            },
          },
        },
        { idempotencyKey: `pi-${order.id}` },
      );
      await orderRef.update({ paymentIntentId: pi.id });
      return { orderId: order.id, orderNumber: order.number, clientSecret: pi.client_secret, totals: order.totals, expiresAt: order.reservationExpiresAt };
    } catch (err) {
      logger.error('payment intent failed', { orderId: order.id, err: String(err) });
      await cancelPendingOrder(order.id, 'payment_setup_failed');
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unavailable', 'We could not start the payment. Please try again.');
    }
  },
);

async function loadAndPrice(skus: string[], input: ReturnType<typeof createCheckoutSchema.parse>, tax: number | null) {
  const invSnaps = await db.getAll(...skus.map((s) => db.collection('inventory').doc(s)));
  const productIds = [...new Set(invSnaps.filter((s) => s.exists).map((s) => (s.data() as InventoryRecord).productId))];
  const productSnaps = productIds.length ? await db.getAll(...productIds.map((id) => db.collection('products').doc(id))) : [];
  const promo = input.promoCode ? await db.collection('promoCodes').doc(input.promoCode.trim().toUpperCase()).get() : null;
  const stock = new Map<string, number>();
  for (const s of invSnaps) if (s.exists) { const d = s.data() as InventoryRecord; stock.set(s.id, d.onHand - d.reserved); }
  const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as Product]));
  const priced = priceCart({
    lines: input.lines, products, stock, delivery: input.delivery,
    promo: (promo?.data() as PromoCode | undefined) ?? null, promoCodeInput: input.promoCode, tax: tax ?? 0, now: now(),
  });
  return { priced };
}

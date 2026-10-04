import { onRequest } from 'firebase-functions/https';
import { logger } from 'firebase-functions';
import type Stripe from 'stripe';
import type { VendorPrivate } from '@dolgers/shared';
import { audit } from './lib/audit.ts';
import { db, now } from './lib/firebase.ts';
import { ledger } from './lib/ledger.ts';
import { cancelPendingOrder, finalizePaidOrder, payVendor } from './lib/orders.ts';
import { REGION, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './lib/params.ts';
import { stripe } from './lib/stripe.ts';

/**
 * Stripe webhook. Register one endpoint for platform events and one for Connect events, both
 * pointing here; STRIPE_WEBHOOK_SECRET may hold both signing secrets separated by a comma.
 * Every event is verified, then recorded so a retried delivery is processed only once.
 */
export const stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], maxInstances: 20, concurrency: 40, invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const signature = req.header('stripe-signature');
    if (!signature) {
      res.status(400).send('Missing signature');
      return;
    }
    let event: Stripe.Event | null = null;
    for (const secret of STRIPE_WEBHOOK_SECRET.value().split(',').map((s) => s.trim()).filter(Boolean)) {
      try {
        event = stripe().webhooks.constructEvent(req.rawBody, signature, secret);
        break;
      } catch {
        // try the next secret
      }
    }
    if (!event) {
      logger.warn('stripe webhook signature failed');
      res.status(400).send('Invalid signature');
      return;
    }

    const seen = db.collection('stripeEvents').doc(event.id);
    try {
      await seen.create({ type: event.type, receivedAt: now(), processed: false });
    } catch {
      const prior = (await seen.get()).data();
      if (prior?.processed) {
        res.json({ received: true, duplicate: true });
        return;
      }
    }

    try {
      await handle(event);
      await seen.update({ processed: true, processedAt: now() });
      res.json({ received: true });
    } catch (err) {
      logger.error('stripe webhook handler failed', { type: event.type, id: event.id, err: String(err) });
      res.status(500).send('Handler failed'); // Stripe retries with backoff
    }
  },
);

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await finalizePaidOrder(event.data.object);
      return;
    case 'payment_intent.canceled': {
      const orderId = event.data.object.metadata.orderId;
      if (orderId) await cancelPendingOrder(orderId, 'payment_canceled');
      return;
    }
    case 'account.updated': {
      const account = event.data.object;
      const link = await db.collection('stripeAccounts').doc(account.id).get();
      const vendorId = link.data()?.vendorId as string | undefined;
      if (!vendorId) return;
      const update: Partial<VendorPrivate> = {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        updatedAt: now(),
      };
      await db.collection('vendorPrivate').doc(vendorId).update(update);
      if (account.payouts_enabled) {
        // Pay out anything that shipped while payouts were still being set up.
        const blocked = await db.collection('vendorOrders').where('vendorId', '==', vendorId).where('payout.status', '==', 'blocked').limit(100).get();
        for (const d of blocked.docs) await payVendor(d.id);
      }
      return;
    }
    case 'charge.dispute.created': {
      const dispute = event.data.object;
      const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
      const order = pi ? (await db.collection('orders').where('paymentIntentId', '==', pi).limit(1).get()).docs[0] : undefined;
      await ledger({ type: 'dispute', amount: dispute.amount, orderId: order?.id ?? null, vendorId: null, stripeId: dispute.id, note: dispute.reason });
      await audit('stripe', 'payment.dispute', order?.id ?? dispute.id, { reason: dispute.reason, amount: dispute.amount });
      return;
    }
    default:
      return;
  }
}

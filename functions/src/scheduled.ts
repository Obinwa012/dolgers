import { onSchedule } from 'firebase-functions/scheduler';
import { logger } from 'firebase-functions';
import type { Order } from '@dolgers/shared';
import { db, now } from './lib/firebase.ts';
import { cancelPendingOrder } from './lib/orders.ts';
import { REGION, STRIPE_SECRET_KEY } from './lib/params.ts';
import { stripe } from './lib/stripe.ts';

/** Frees stock held by checkouts that were never paid. */
export const releaseExpiredReservations = onSchedule(
  { region: REGION, schedule: 'every 10 minutes', secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 300 },
  async () => {
    const expired = await db.collection('orders')
      .where('status', '==', 'pending_payment')
      .where('reservationExpiresAt', '<', now())
      .limit(200)
      .get();
    let released = 0;
    for (const doc of expired.docs) {
      const order = doc.data() as Order;
      if (order.paymentIntentId) {
        const pi = await stripe().paymentIntents.retrieve(order.paymentIntentId).catch(() => null);
        // A payment in flight is left alone: the webhook settles it either way.
        if (pi && ['processing', 'succeeded', 'requires_capture'].includes(pi.status)) continue;
        if (pi && pi.status !== 'canceled') await stripe().paymentIntents.cancel(pi.id).catch(() => undefined);
      }
      if (await cancelPendingOrder(order.id, 'reservation_expired')) released += 1;
    }
    if (released) logger.info('released expired reservations', { released });
  },
);

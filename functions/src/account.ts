import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/https';
import { RETURN_WINDOW_DAYS, accountActionSchema, type Order, type ReturnRequest, type VendorOrder, type VendorPrivate } from '@dolgers/shared';
import { db, now } from './lib/firebase.ts';
import { parse, rateLimit, requireAuth } from './lib/guard.ts';
import { queueMail } from './lib/mail.ts';
import { cancelPendingOrder } from './lib/orders.ts';
import { ENFORCE_APP_CHECK, REGION, STRIPE_SECRET_KEY } from './lib/params.ts';
import { stripe } from './lib/stripe.ts';

/** Shopper actions: returns, newsletter, abandoning a pending checkout. */
export const accountApi = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 10, concurrency: 40 },
  async (req) => {
    const caller = requireAuth(req);
    const { action, data } = parse(accountActionSchema, req.data);
    await rateLimit(`account:${action}:${caller.uid}`, action === 'subscribe' ? 3 : 20, 3600);

    switch (action) {
      case 'subscribe': {
        const email = data.email.toLowerCase();
        const id = createHash('sha256').update(email).digest('hex').slice(0, 40);
        await db.collection('subscribers').doc(id).set({ email, subscribedAt: now(), source: 'footer' }, { merge: true });
        return { ok: true };
      }
      case 'cancelPendingOrder': {
        const order = (await db.collection('orders').doc(data.orderId).get()).data() as Order | undefined;
        if (!order || order.uid !== caller.uid) throw new HttpsError('not-found', 'Order not found.');
        const cancelled = await cancelPendingOrder(order.id, 'buyer_left_checkout');
        if (cancelled && order.paymentIntentId) await stripe().paymentIntents.cancel(order.paymentIntentId).catch(() => undefined);
        return { cancelled };
      }
      case 'requestReturn': {
        if (caller.anonymous) throw new HttpsError('unauthenticated', 'Create an account to request a return.');
        const vo = (await db.collection('vendorOrders').doc(data.vendorOrderId).get()).data() as VendorOrder | undefined;
        if (!vo || vo.uid !== caller.uid) throw new HttpsError('not-found', 'Order not found.');
        if (vo.status !== 'shipped') throw new HttpsError('failed-precondition', 'Items can be returned once they have shipped.');
        if (now() - (vo.shippedAt ?? vo.createdAt) > (RETURN_WINDOW_DAYS + 7) * 86_400_000) {
          throw new HttpsError('failed-precondition', `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery.`);
        }
        const prior = await db.collection('returns').where('vendorOrderId', '==', vo.id).where('uid', '==', caller.uid).get();
        const alreadyReturned = new Map<string, number>();
        for (const d of prior.docs) {
          const r = d.data() as ReturnRequest;
          if (r.status === 'rejected') continue;
          for (const l of r.lines) alreadyReturned.set(l.sku, (alreadyReturned.get(l.sku) ?? 0) + l.quantity);
        }
        const lines = data.lines.map((l) => {
          const bought = vo.lines.find((b) => b.sku === l.sku);
          if (!bought) throw new HttpsError('invalid-argument', 'That item is not in this order.');
          if (l.quantity + (alreadyReturned.get(l.sku) ?? 0) > bought.quantity) {
            throw new HttpsError('invalid-argument', `You can return at most ${bought.quantity - (alreadyReturned.get(l.sku) ?? 0)} of ${bought.title}.`);
          }
          return { sku: l.sku, title: bought.title, size: bought.size, quantity: l.quantity, unitPrice: bought.unitPrice };
        });
        const gross = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
        // The buyer gets back what they actually paid for these items, after their share of any discount.
        const refundAmount = gross - Math.round((gross * vo.discountShare) / Math.max(1, vo.subtotal));
        const ref = db.collection('returns').doc();
        const ret: ReturnRequest = {
          id: ref.id,
          orderId: vo.orderId,
          orderNumber: vo.orderNumber,
          vendorOrderId: vo.id,
          vendorId: vo.vendorId,
          uid: caller.uid,
          lines,
          reason: data.reason,
          status: 'requested',
          note: '',
          refundAmount,
          createdAt: now(),
          updatedAt: now(),
        };
        await ref.set(ret);
        const priv = (await db.collection('vendorPrivate').doc(vo.vendorId).get()).data() as VendorPrivate | undefined;
        if (priv?.contactEmail) {
          await queueMail(priv.contactEmail, `Return requested on ${vo.orderNumber}`, `A customer asked to return ${lines.length} item(s). Review it in your vendor dashboard.`);
        }
        return { id: ref.id };
      }
    }
  },
);

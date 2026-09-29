import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { DISCOUNT_CODES } from "@/lib/pricing";
import { adminDb } from "@/lib/server/admin";
import { stripe } from "@/lib/server/stripe";
import { buildSellerOrders, sellerOf } from "@/lib/marketplace";
import type { Order, SellerAccount } from "@/lib/types";

/**
 * POST /api/stripe/webhook
 * Stripe → this endpoint. Subscribe it to:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, checkout.session.expired,
 *   charge.dispute.created
 *
 * This is the only place an order becomes "paid". Handlers are idempotent because Stripe retries.
 */
export async function POST(request: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("Stripe is not configured.", { status: 503 });

  let event: Stripe.Event;
  try {
    // The signature covers the exact bytes Stripe sent, so read the raw body (never request.json()).
    const payload = await request.text();
    event = s.webhooks.constructEvent(payload, request.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        // Card payments are "paid" on completion; delayed methods (bank debits) arrive later as
        // async_payment_succeeded, and completed fires with payment_status "unpaid" first.
        if (session.payment_status === "paid") await markPaid(s, session);
        break;
      }
      case "checkout.session.async_payment_failed":
        await setStatus(event.data.object, "payment_failed");
        break;
      case "checkout.session.expired":
        await setStatus(event.data.object, "canceled");
        break;
      case "charge.dispute.created":
        await flagDispute(s, event.data.object);
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  return Response.json({ received: true });
}

const orderIdOf = (session: Stripe.Checkout.Session) => session.metadata?.orderId ?? session.client_reference_id;

async function setStatus(session: Stripe.Checkout.Session, status: "payment_failed" | "canceled") {
  const id = orderIdOf(session);
  if (!id) return;
  const ref = adminDb().collection("orders").doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // Never downgrade an order that has already been paid.
    if (!snap.exists || (snap.data() as Order).status === "paid") return;
    tx.update(ref, { status });
  });
}

async function markPaid(s: Stripe, session: Stripe.Checkout.Session) {
  const id = orderIdOf(session);
  if (!id) throw new Error(`Checkout session ${session.id} has no orderId`);
  const db = adminDb();
  const ref = db.collection("orders").doc(id);
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  // The charge id lets seller payouts draw on this payment (transfers with source_transaction).
  const chargeId = paymentIntentId
    ? await s.paymentIntents.retrieve(paymentIntentId).then((pi) =>
        typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null),
      )
    : null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Order ${id} not found for session ${session.id}`);
    const order = snap.data() as Order;
    if (order.status === "paid") return; // duplicate delivery

    const problems: string[] = [];
    if (session.id !== order.stripeSessionId) problems.push("session id mismatch");
    if (session.amount_total !== order.totalCents)
      problems.push(`amount mismatch: charged ${session.amount_total}, expected ${order.totalCents}`);

    // First-order codes: two tabs could both start checkout before either is paid. Pay the order
    // (the customer has been charged) but flag it.
    if (order.discountCode && DISCOUNT_CODES[order.discountCode]?.firstOrderOnly) {
      const earlier = await tx.get(
        db.collection("orders").where("uid", "==", order.uid).where("status", "==", "paid").limit(1),
      );
      if (!earlier.empty) problems.push(`${order.discountCode} used on a non-first order`);
    }

    // Decrement stock for products stored in Firestore (the bundled demo catalog has none to track).
    // Stock is per product, so sum quantities across variants first (one update per product doc).
    const qtyByProduct = new Map<string, number>();
    for (const i of order.items) qtyByProduct.set(i.productId, (qtyByProduct.get(i.productId) ?? 0) + i.qty);
    const productIds = [...qtyByProduct.keys()];
    const productSnaps = productIds.length
      ? await tx.getAll(...productIds.map((pid) => db.collection("products").doc(pid)))
      : [];
    // Commission rates for the sellers in this order. (Read now: a transaction's reads must all
    // happen before its first write.)
    const sellerSlugs = [...new Set(order.items.map(sellerOf))];
    const accounts = await tx.getAll(...sellerSlugs.map((slug) => db.collection("sellerAccounts").doc(slug)));
    const rates = Object.fromEntries(accounts.map((a) => [a.id, (a.data() as SellerAccount | undefined)?.commissionRate]));

    productSnaps.forEach((p) => {
      if (!p.exists) return;
      const stock = p.get("stock");
      if (typeof stock !== "number") return;
      const qty = qtyByProduct.get(p.id) ?? 0;
      if (stock < qty) problems.push(`oversold ${p.id}: had ${stock}, sold ${qty}`);
      tx.update(p.ref, { stock: Math.max(0, stock - qty) });
    });

    // One fulfilment record per seller, so each seller sees (and ships) only their part of the order.
    const now = Date.now();
    for (const so of buildSellerOrders(order, id, rates, now)) {
      const { id: soId, ...data } = so;
      tx.set(db.collection("sellerOrders").doc(soId), data);
    }

    tx.update(ref, {
      status: "paid",
      paidAt: now,
      amountPaidCents: session.amount_total ?? null,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      needsReview: problems.length ? problems.join("; ") : FieldValue.delete(),
    });
  });
}

/** A card dispute (chargeback) freezes the question of who pays; flag the order for a human. */
async function flagDispute(s: Stripe, dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!piId) return;
  const pi = await s.paymentIntents.retrieve(piId);
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;
  await adminDb()
    .collection("orders")
    .doc(orderId)
    .update({ disputed: true, needsReview: `card dispute ${dispute.id}: ${dispute.reason} (${dispute.amount} cents)` });
}

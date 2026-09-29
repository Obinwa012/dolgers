import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { DISCOUNT_CODES } from "@/lib/pricing";
import { adminDb } from "@/lib/server/admin";
import { stripe } from "@/lib/server/stripe";
import type { Order } from "@/lib/types";

/**
 * POST /api/stripe/webhook
 * Stripe → this endpoint. Subscribe it to:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, checkout.session.expired
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
        if (session.payment_status === "paid") await markPaid(session);
        break;
      }
      case "checkout.session.async_payment_failed":
        await setStatus(event.data.object, "payment_failed");
        break;
      case "checkout.session.expired":
        await setStatus(event.data.object, "canceled");
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

async function markPaid(session: Stripe.Checkout.Session) {
  const id = orderIdOf(session);
  if (!id) throw new Error(`Checkout session ${session.id} has no orderId`);
  const db = adminDb();
  const ref = db.collection("orders").doc(id);

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
    productSnaps.forEach((p) => {
      if (!p.exists) return;
      const stock = p.get("stock");
      if (typeof stock !== "number") return;
      const qty = qtyByProduct.get(p.id) ?? 0;
      if (stock < qty) problems.push(`oversold ${p.id}: had ${stock}, sold ${qty}`);
      tx.update(p.ref, { stock: Math.max(0, stock - qty) });
    });

    tx.update(ref, {
      status: "paid",
      paidAt: Date.now(),
      amountPaidCents: session.amount_total ?? null,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      needsReview: problems.length ? problems.join("; ") : FieldValue.delete(),
    });
  });
}

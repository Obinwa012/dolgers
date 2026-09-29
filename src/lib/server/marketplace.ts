import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { buildSellerOrders, MarketplaceError, reversalCents, sellerOf } from "@/lib/marketplace";
import { CURRENCY } from "@/lib/pricing";
import type { Order, ReturnRequest, SellerAccount, SellerOrder } from "@/lib/types";
import { adminDb, verifyRequestUser } from "./admin";
import { stripe } from "./stripe";

/** Signed-in user or a 401. */
export async function requireUser(request: Request): Promise<DecodedIdToken> {
  const user = await verifyRequestUser(request);
  if (!user) throw new MarketplaceError("Please sign in.", 401);
  return user;
}

export async function requireAdmin(request: Request): Promise<DecodedIdToken> {
  const user = await requireUser(request);
  if (user.admin !== true) throw new MarketplaceError("Admins only.", 403);
  return user;
}

/**
 * The seller account this user manages, looked up from the admin-only `sellerAccounts` collection.
 * (Never from anything the user can write, like their `users/{uid}` doc.)
 */
export async function sellerAccountFor(uid: string): Promise<(SellerAccount & { ref: DocumentReference }) | null> {
  const snap = await adminDb().collection("sellerAccounts").where("ownerUid", "==", uid).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as SellerAccount), ref: d.ref };
}

export async function requireSeller(request: Request) {
  const user = await requireUser(request);
  const account = await sellerAccountFor(user.uid);
  if (!account) throw new MarketplaceError("This account isn't an approved seller.", 403);
  return { user, account };
}

/** JSON error response for MarketplaceError; anything else is logged and hidden. */
export function errorResponse(err: unknown, tag: string) {
  if (err instanceof MarketplaceError) return Response.json({ error: err.message }, { status: err.status });
  console.error(`[${tag}]`, err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/**
 * Pay a seller their net share of a shipped order. Funds come from the customer's charge
 * (`source_transaction`), so the transfer can't outrun the money. Idempotent per seller order.
 */
export async function releasePayout(soRef: DocumentReference): Promise<SellerOrder["payout"]> {
  const db = adminDb();
  const so = (await soRef.get()).data() as SellerOrder | undefined;
  if (!so || so.payout === "none" || so.payout === "transferred") return so?.payout ?? "none";
  if (so.status !== "shipped" && so.status !== "delivered") return so.payout;

  const s = stripe();
  if (!s) {
    await soRef.update({ payout: "not_configured" });
    return "not_configured";
  }
  const [accountSnap, orderSnap] = await Promise.all([
    db.collection("sellerAccounts").doc(so.seller).get(),
    db.collection("orders").doc(so.orderId).get(),
  ]);
  const account = accountSnap.data() as SellerAccount | undefined;
  const order = orderSnap.data() as Order | undefined;
  if (!account?.stripeAccountId || !account.payoutsEnabled || !order?.stripeChargeId) {
    await soRef.update({ payout: "pending_onboarding" });
    return "pending_onboarding";
  }
  const amount = so.netCents - (so.reversedCents ?? 0);
  if (amount <= 0) {
    await soRef.update({ payout: "transferred" });
    return "transferred";
  }
  const transfer = await s.transfers.create(
    {
      amount,
      currency: CURRENCY,
      destination: account.stripeAccountId,
      source_transaction: order.stripeChargeId,
      transfer_group: so.orderId,
      metadata: { orderId: so.orderId, seller: so.seller, sellerOrderId: soRef.id },
    },
    { idempotencyKey: `transfer-${soRef.id}` },
  );
  await soRef.update({ payout: "transferred", transferId: transfer.id });
  return "transferred";
}

/**
 * Refund a return to the customer and claw back the seller's share of it. Safe to retry: Stripe
 * calls use idempotency keys derived from the return id, and the Firestore totals are only bumped
 * once (guarded by `refundId`).
 */
export async function refundReturn(returnRef: DocumentReference): Promise<string> {
  const db = adminDb();
  const ret = (await returnRef.get()).data() as ReturnRequest;
  if (ret.refundId) return ret.refundId;
  const soRef = db.collection("sellerOrders").doc(ret.sellerOrderId);
  const [soSnap, orderSnap] = await Promise.all([soRef.get(), db.collection("orders").doc(ret.orderId).get()]);
  const so = soSnap.data() as SellerOrder;
  const order = orderSnap.data() as Order;

  // Never refund more than is left on the charge (discounts can make the charge smaller than list price).
  const refunded = Math.min(ret.amountCents, (order.amountPaidCents ?? order.totalCents) - (order.refundedCents ?? 0));
  if (refunded <= 0) throw new MarketplaceError("This order has already been fully refunded.", 409);
  // The seller gives back their net share of the refund: clawed back from a transfer that already
  // went out, or deducted from the one still to come.
  const reversed = so.payout === "none" ? 0 : reversalCents(so, refunded, so.reversedCents ?? 0);

  let refundId = "demo_refund";
  const s = stripe();
  if (s && order.stripePaymentIntentId) {
    const refund = await s.refunds.create(
      { payment_intent: order.stripePaymentIntentId, amount: refunded, metadata: { returnId: returnRef.id, orderId: ret.orderId } },
      { idempotencyKey: `refund-${returnRef.id}` },
    );
    refundId = refund.id;
    if (so.payout === "transferred" && so.transferId && reversed > 0)
      await s.transfers.createReversal(so.transferId, { amount: reversed, metadata: { returnId: returnRef.id } }, { idempotencyKey: `reversal-${returnRef.id}` });
  }

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(returnRef)).data() as ReturnRequest;
    if (fresh.refundId) return;
    tx.update(returnRef, { refundId, refundedCents: refunded, updatedAt: Date.now() });
    tx.update(soRef, {
      refundedCents: FieldValue.increment(refunded),
      ...(reversed ? { reversedCents: FieldValue.increment(reversed) } : {}),
    });
    tx.update(db.collection("orders").doc(ret.orderId), { refundedCents: FieldValue.increment(refunded) });
  });
  return refundId;
}

/** Per-seller records for an order paid outside the webhook (demo mode). */
export async function writeSellerOrders(orderId: string, order: Order) {
  const db = adminDb();
  const slugs = [...new Set(order.items.map(sellerOf))];
  const accounts = await db.getAll(...slugs.map((slug) => db.collection("sellerAccounts").doc(slug)));
  const rates = Object.fromEntries(accounts.map((a) => [a.id, (a.data() as SellerAccount | undefined)?.commissionRate]));
  const batch = db.batch();
  for (const { id, ...data } of buildSellerOrders(order, orderId, rates, Date.now())) batch.set(db.collection("sellerOrders").doc(id), data);
  await batch.commit();
}

/** Strip undefined values (Firestore rejects them). */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

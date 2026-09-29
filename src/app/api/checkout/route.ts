import { CURRENCY, toCents } from "@/lib/pricing";
import { loadProducts, adminDb, verifyRequestUser } from "@/lib/server/admin";
import { buildOrder, CheckoutError, parseCheckoutRequest } from "@/lib/server/checkout-core";
import { demoCheckoutAllowed, siteUrl, stripe } from "@/lib/server/stripe";

/**
 * POST /api/checkout
 * Body: { items: [{ productId, variantId, qty }], code?, address }
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * The browser sends only ids and quantities. Prices, discounts, shipping and stock are all
 * resolved here from the catalog, the order is written with the Admin SDK (clients can no longer
 * create orders), and the customer is sent to Stripe Checkout. The Stripe webhook marks it paid.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) return Response.json({ error: "Please sign in to check out." }, { status: 401 });

    const req = parseCheckoutRequest(await request.json().catch(() => null));
    const db = adminDb();

    const [{ products }, paid] = await Promise.all([
      loadProducts([...new Set(req.items.map((i) => i.productId))]),
      db.collection("orders").where("uid", "==", user.uid).where("status", "==", "paid").limit(1).get(),
    ]);

    const order = buildOrder({
      req,
      products,
      uid: user.uid,
      email: user.email ?? "",
      hasPaidOrder: !paid.empty,
      now: Date.now(),
    });

    const s = stripe();
    if (!s) {
      if (!demoCheckoutAllowed())
        return Response.json({ error: "Payments aren't configured yet. Please try again later." }, { status: 503 });
      const ref = await db.collection("orders").add({ ...order, status: "placed" });
      return Response.json({ orderId: ref.id, demo: true });
    }

    const ref = db.collection("orders").doc();
    await ref.set(order);

    try {
      // One-off coupon for the exact discount we computed, so Stripe's total matches ours to the cent.
      const coupon =
        order.discountCode && order.discount > 0
          ? await s.coupons.create(
              {
                amount_off: toCents(order.discount),
                currency: CURRENCY,
                duration: "once",
                max_redemptions: 1,
                name: order.discountCode,
                metadata: { orderId: ref.id },
              },
              { idempotencyKey: `coupon-${ref.id}` },
            )
          : null;

      const base = siteUrl(request);
      const session = await s.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: order.email || undefined,
          client_reference_id: ref.id,
          metadata: { orderId: ref.id, uid: user.uid },
          payment_intent_data: { metadata: { orderId: ref.id, uid: user.uid } },
          line_items: order.items.map((i) => ({
            quantity: i.qty,
            price_data: {
              currency: CURRENCY,
              unit_amount: toCents(i.price),
              product_data: {
                name: i.title,
                description: i.variantName,
                metadata: { productId: i.productId, variantId: i.variantId },
              },
            },
          })),
          discounts: coupon ? [{ coupon: coupon.id }] : undefined,
          shipping_options: [
            {
              shipping_rate_data: {
                display_name: order.shipping > 0 ? "Standard shipping" : "Free shipping",
                type: "fixed_amount",
                fixed_amount: { amount: toCents(order.shipping), currency: CURRENCY },
              },
            },
          ],
          success_url: `${base}/checkout/success?order=${ref.id}`,
          cancel_url: `${base}/checkout?canceled=1`,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour; expiry marks the order canceled
        },
        { idempotencyKey: `session-${ref.id}` },
      );

      await ref.update({ stripeSessionId: session.id });
      if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
      return Response.json({ url: session.url, orderId: ref.id });
    } catch (err) {
      await ref.delete().catch(() => {});
      throw err;
    }
  } catch (err) {
    if (err instanceof CheckoutError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[checkout]", err);
    return Response.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}

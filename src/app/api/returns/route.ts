import * as local from "@/data/catalog";
import { MarketplaceError, nextReturnStatus, validateReturn } from "@/lib/marketplace";
import { adminDb } from "@/lib/server/admin";
import { errorResponse, requireUser } from "@/lib/server/marketplace";
import type { ReturnRequest, Seller, SellerOrder } from "@/lib/types";

/**
 * POST /api/returns  (customer)
 *   { action: "request", sellerOrderId, productId, variantId, qty, reason, details }
 *   { action: "escalate", returnId }   → hands the case to Dolgers
 * Customers read their own returns directly from Firestore (see firestore.rules).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const db = adminDb();

    if (body.action === "request") {
      const soId = typeof body.sellerOrderId === "string" ? body.sellerOrderId : "";
      const soRef = db.collection("sellerOrders").doc(soId || "-");
      const sellerSlug = soId.includes("_") ? soId.slice(soId.indexOf("_") + 1) : "";
      const sellerSnap = await db.collection("sellers").doc(sellerSlug || "-").get();
      const seller = (sellerSnap.data() as Seller | undefined) ?? local.sellers.find((s) => s.slug === sellerSlug);
      const ref = db.collection("returns").doc();
      await db.runTransaction(async (tx) => {
        const so = (await tx.get(soRef)).data() as SellerOrder | undefined;
        if (!so || so.uid !== user.uid) throw new MarketplaceError("Order not found.", 404);
        // Quantity already in open or refunded returns for this line (denied/rejected don't count).
        const earlier = await tx.get(db.collection("returns").where("sellerOrderId", "==", soRef.id));
        const alreadyReturned = earlier.docs
          .map((d) => d.data() as ReturnRequest)
          .filter((r) => r.productId === body.productId && r.variantId === body.variantId && r.status !== "resolved_denied")
          .reduce((n, r) => n + r.qty, 0);
        const input = validateReturn(body, so, { now: Date.now(), returnDays: seller?.returnDays ?? 30, alreadyReturned });
        const now = Date.now();
        const ret: ReturnRequest = {
          ...input,
          orderId: so.orderId,
          sellerOrderId: soRef.id,
          seller: so.seller,
          uid: user.uid,
          status: "requested",
          createdAt: now,
          updatedAt: now,
        };
        tx.create(ref, ret);
      });
      return Response.json({ ok: true, id: ref.id });
    }

    if (body.action === "escalate") {
      const ref = db.collection("returns").doc(typeof body.returnId === "string" && body.returnId ? body.returnId : "-");
      const status = await db.runTransaction(async (tx) => {
        const r = (await tx.get(ref)).data() as ReturnRequest | undefined;
        if (!r || r.uid !== user.uid) throw new MarketplaceError("Return not found.", 404);
        const next = nextReturnStatus(r.status, "customer", "escalate", { now: Date.now(), createdAt: r.createdAt });
        tx.update(ref, { status: next, updatedAt: Date.now() });
        return next;
      });
      return Response.json({ ok: true, status });
    }

    throw new MarketplaceError("Unknown action.");
  } catch (err) {
    return errorResponse(err, "returns");
  }
}

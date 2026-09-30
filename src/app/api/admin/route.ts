import * as local from "@/data/catalog";
import { COMMISSION_RATE, MarketplaceError, nextReturnStatus, refundsOn, slugify } from "@/lib/marketplace";
import { adminDb } from "@/lib/server/admin";
import { errorResponse, refundReturn, requireAdmin } from "@/lib/server/marketplace";
import type { Order, ReturnRequest, Seller, SellerAccount, SellerApplication } from "@/lib/types";

/**
 * Dolgers staff (custom claim `admin: true`).
 * GET  → pending seller applications, escalated returns, orders flagged for review.
 * POST → { action: "approve", uid, commissionRate? } | { action: "reject", uid, note }
 *        | { action: "resolveReturn", returnId, decision: "refund" | "deny", note }
 *        | { action: "retryRefund", returnId }
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = adminDb();
    const [apps, returns, flagged] = await Promise.all([
      db.collection("sellerApplications").where("status", "==", "pending").get(),
      db.collection("returns").where("status", "in", ["escalated", "requested", "rejected", "approved", "resolved_refund"]).get(),
      db.collection("orders").where("needsReview", "!=", null).limit(50).get(),
    ]);
    return Response.json({
      applications: apps.docs.map((d) => d.data() as SellerApplication).sort((a, b) => a.createdAt - b.createdAt),
      // Open cases, plus approved refunds that never went through (e.g. a Stripe error) so they can be retried.
      returns: returns.docs
        .map((d) => ({ ...(d.data() as ReturnRequest), id: d.id }))
        .filter((r) => !refundsOn(r.status) || !r.refundId)
        .sort((a, b) => a.createdAt - b.createdAt),
      flagged: flagged.docs.map((d) => {
        const o = d.data() as Order;
        return { id: d.id, total: o.total, status: o.status, needsReview: o.needsReview, createdAt: o.createdAt };
      }),
    });
  } catch (err) {
    return errorResponse(err, "admin GET");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const db = adminDb();

    if (body.action === "approve" || body.action === "reject") {
      const uid = typeof body.uid === "string" ? body.uid : "";
      const appRef = db.collection("sellerApplications").doc(uid || "-");
      if (body.action === "reject") {
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
        if (note.length < 5) throw new MarketplaceError("Give the applicant a reason.");
        await db.runTransaction(async (tx) => {
          const app = (await tx.get(appRef)).data() as SellerApplication | undefined;
          if (app?.status !== "pending") throw new MarketplaceError("That application isn't pending.", 409);
          tx.update(appRef, { status: "rejected", note, decidedAt: Date.now() });
        });
        return Response.json({ ok: true });
      }

      const rate = typeof body.commissionRate === "number" && body.commissionRate >= 0 && body.commissionRate <= 0.5 ? body.commissionRate : undefined;
      const slug = await db.runTransaction(async (tx) => {
        const app = (await tx.get(appRef)).data() as SellerApplication | undefined;
        if (app?.status !== "pending") throw new MarketplaceError("That application isn't pending.", 409);
        const base = slugify(app.businessName) || "seller";
        // Pick a free slug (also never collide with the bundled demo sellers).
        let slug = base;
        for (let n = 2; (await tx.get(db.collection("sellers").doc(slug))).exists || local.sellers.some((s) => s.slug === slug); n++) slug = `${base}-${n}`;
        const now = Date.now();
        const seller: Seller = {
          slug, name: app.businessName, tagline: `Marketplace seller since ${new Date(now).getUTCFullYear()}`,
          about: app.description, rating: 0, ratingCount: 0, since: new Date(now).toISOString().slice(0, 10),
          location: app.country, color: "#334155", handlingDays: 2, returns: "seller", returnDays: 30, warranty: "manufacturer", status: "active",
        };
        const account: SellerAccount = { seller: slug, ownerUid: app.uid, email: app.email, createdAt: now, ...(rate !== undefined ? { commissionRate: rate } : {}) };
        tx.set(db.collection("sellers").doc(slug), seller);
        tx.set(db.collection("sellerAccounts").doc(slug), account);
        tx.update(appRef, { status: "approved", decidedAt: now, sellerSlug: slug });
        return slug;
      });
      return Response.json({ ok: true, slug, commissionRate: rate ?? COMMISSION_RATE });
    }

    if (body.action === "retryRefund") {
      const ref = db.collection("returns").doc(typeof body.returnId === "string" && body.returnId ? body.returnId : "-");
      const r = (await ref.get()).data() as ReturnRequest | undefined;
      if (!r || !refundsOn(r.status)) throw new MarketplaceError("That return isn't approved for a refund.", 409);
      return Response.json({ ok: true, refundId: await refundReturn(ref) });
    }

    if (body.action === "resolveReturn") {
      const ref = db.collection("returns").doc(typeof body.returnId === "string" && body.returnId ? body.returnId : "-");
      const decision = body.decision === "refund" ? "refund" : body.decision === "deny" ? "deny" : null;
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
      if (!decision) throw new MarketplaceError("Choose refund or deny.");
      const status = await db.runTransaction(async (tx) => {
        const r = (await tx.get(ref)).data() as ReturnRequest | undefined;
        if (!r) throw new MarketplaceError("Return not found.", 404);
        const next = nextReturnStatus(r.status, "admin", decision);
        tx.update(ref, { status: next, adminNote: note, updatedAt: Date.now() });
        return next;
      });
      if (status === "resolved_refund") await refundReturn(ref);
      return Response.json({ ok: true, status });
    }

    throw new MarketplaceError("Unknown action.");
  } catch (err) {
    return errorResponse(err, "admin POST");
  }
}

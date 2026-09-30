import { FieldValue } from "firebase-admin/firestore";
import * as local from "@/data/catalog";
import {
  canReapply, MarketplaceError, nextReturnStatus, slugify, validateAnswer, validateApplication, validateListing,
  validateListingUpdate, validateTracking,
} from "@/lib/marketplace";
import { adminDb } from "@/lib/server/admin";
import {
  clean, errorResponse, refundReturn, releasePayout, requireSeller, requireUser, sellerAccountFor,
} from "@/lib/server/marketplace";
import { siteUrl, stripe } from "@/lib/server/stripe";
import type {
  Brand, Category, Product, Question, ReturnRequest, Seller, SellerApplication, SellerOrder,
} from "@/lib/types";

/**
 * GET  /api/seller  → everything the seller dashboard needs for the signed-in user.
 * POST /api/seller  → { action, ...fields }: apply, connect, createListing, updateListing, ship,
 *                     decideReturn, answer.
 * All writes go through here (Admin SDK) so ownership and input are checked in one place;
 * firestore.rules gives clients no write access to any of these collections.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const db = adminDb();
    const [appSnap, account] = await Promise.all([
      db.collection("sellerApplications").doc(user.uid).get(),
      sellerAccountFor(user.uid),
    ]);
    const application = appSnap.exists ? (appSnap.data() as SellerApplication) : null;
    const [categories, brands] = await Promise.all([
      readAll<Category>("categories", local.categories),
      readAll<Brand>("brands", local.brands),
    ]);
    if (!account) return Response.json({ application, seller: null, categories });

    const slug = account.seller;
    // Keep payout status in step with Stripe, and release payouts that were waiting on onboarding.
    let payoutsEnabled = account.payoutsEnabled ?? false;
    const s = stripe();
    if (s && account.stripeAccountId) {
      const acct = await s.accounts.retrieve(account.stripeAccountId);
      payoutsEnabled = Boolean(acct.payouts_enabled && acct.capabilities?.transfers === "active");
      if (payoutsEnabled !== account.payoutsEnabled) await account.ref.update({ payoutsEnabled });
    }

    const [sellerSnap, productsSnap, seeded, ordersSnap, returnsSnap, questionsSnap] = await Promise.all([
      db.collection("sellers").doc(slug).get(),
      db.collection("products").where("seller", "==", slug).get(),
      catalogSeeded(),
      db.collection("sellerOrders").where("seller", "==", slug).get(),
      db.collection("returns").where("seller", "==", slug).get(),
      db.collection("questions").where("seller", "==", slug).where("status", "==", "open").get(),
    ]);
    if (payoutsEnabled)
      await Promise.all(ordersSnap.docs.filter((d) => d.get("payout") === "pending_onboarding").map((d) => releasePayout(d.ref)));

    const products = seeded
      ? productsSnap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }))
      : local.products.filter((p) => p.seller === slug);
    const productIds = new Set(products.map((p) => p.id));
    const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;
    // Re-read orders: payouts may have just been released.
    const orders = (payoutsEnabled ? await db.collection("sellerOrders").where("seller", "==", slug).get() : ordersSnap).docs
      .map((d) => ({ ...(d.data() as SellerOrder), id: d.id }))
      .sort(byNewest);

    return Response.json({
      application,
      categories,
      brands,
      seller: sellerSnap.exists ? (sellerSnap.data() as Seller) : null,
      account: {
        connected: Boolean(account.stripeAccountId),
        payoutsEnabled,
        commissionRate: account.commissionRate ?? null,
      },
      stripeConfigured: Boolean(s),
      catalogSeeded: seeded,
      products: products.sort(byNewest),
      orders,
      returns: returnsSnap.docs.map((d) => ({ ...(d.data() as ReturnRequest), id: d.id })).sort(byNewest),
      // Questions are client-written, so only show ones about this seller's own listings.
      questions: questionsSnap.docs
        .map((d) => ({ ...(d.data() as Question), id: d.id, createdAt: toMillis(d.get("createdAt")) }))
        .filter((q) => productIds.has(q.productId))
        .sort(byNewest),
    });
  } catch (err) {
    return errorResponse(err, "seller GET");
  }
}

export async function POST(request: Request) {
  try {
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    switch (body.action) {
      case "apply":
        return await apply(request, body);
      case "connect":
        return await connect(request);
      case "createListing":
        return await createListing(request, body);
      case "updateListing":
        return await updateListing(request, body);
      case "ship":
        return await ship(request, body);
      case "decideReturn":
        return await decideReturn(request, body);
      case "answer":
        return await answer(request, body);
      default:
        throw new MarketplaceError("Unknown action.");
    }
  } catch (err) {
    return errorResponse(err, "seller POST");
  }
}

const toMillis = (v: unknown) =>
  typeof v === "number" ? v : v && typeof (v as { toMillis?: () => number }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : 0;

async function catalogSeeded() {
  return !(await adminDb().collection("products").limit(1).get()).empty;
}

async function readAll<T>(name: string, fallback: T[]): Promise<T[]> {
  const snap = await adminDb().collection(name).get();
  return snap.empty ? fallback : snap.docs.map((d) => d.data() as T);
}

// --- actions -------------------------------------------------------------------------------------

async function apply(request: Request, body: Record<string, unknown>) {
  const user = await requireUser(request);
  if (!user.email || !user.email_verified)
    throw new MarketplaceError("Verify your email address before applying (check your inbox, or sign in with Google).", 403);
  const categories = await readAll<Category>("categories", local.categories);
  const input = validateApplication(body, categories.map((c) => c.slug));
  const ref = adminDb().collection("sellerApplications").doc(user.uid);
  await adminDb().runTransaction(async (tx) => {
    const prev = (await tx.get(ref)).data() as SellerApplication | undefined;
    if (!canReapply(prev?.status))
      throw new MarketplaceError(prev?.status === "approved" ? "You're already an approved seller." : "Your application is already being reviewed.", 409);
    const app: SellerApplication = { ...input, uid: user.uid, email: user.email!, status: "pending", createdAt: Date.now() };
    tx.set(ref, app);
  });
  return Response.json({ ok: true });
}

/** Start (or resume) Stripe Connect onboarding: identity, business and bank checks happen on Stripe. */
async function connect(request: Request) {
  const { user, account } = await requireSeller(request);
  const s = stripe();
  if (!s) throw new MarketplaceError("Payouts aren't configured on this store yet (no Stripe key).", 503);
  let acctId = account.stripeAccountId;
  if (!acctId) {
    const sellerDoc = (await adminDb().collection("sellers").doc(account.seller).get()).data() as Seller | undefined;
    const acct = await s.accounts.create(
      {
        type: "express",
        email: account.email || user.email,
        business_profile: { name: sellerDoc?.name },
        capabilities: { transfers: { requested: true } },
        metadata: { seller: account.seller, uid: user.uid },
      },
      { idempotencyKey: `acct-${account.seller}` },
    );
    acctId = acct.id;
    await account.ref.update({ stripeAccountId: acctId });
  }
  const base = siteUrl(request);
  const link = await s.accountLinks.create({
    account: acctId,
    type: "account_onboarding",
    refresh_url: `${base}/seller?connect=refresh`,
    return_url: `${base}/seller?connect=done`,
  });
  return Response.json({ url: link.url });
}

async function createListing(request: Request, body: Record<string, unknown>) {
  const { account } = await requireSeller(request);
  // Guard: the storefront falls back to the bundled catalog only while `products` is empty, so a
  // first listing written to an unseeded project would replace the whole catalog with one item.
  if (!(await catalogSeeded())) throw new MarketplaceError("The store's catalog isn't seeded yet (npm run seed), so new listings can't be added.", 409);
  const [categories, brands] = await Promise.all([
    readAll<Category>("categories", local.categories),
    readAll<Brand>("brands", local.brands),
  ]);
  const input = validateListing(body, { categories, brandSlugs: brands.map((b) => b.slug) });
  const cat = categories.find((c) => c.slug === input.category)!;
  const base = slugify(`${input.title}`) || "listing";
  const db = adminDb();
  // Unique slug: add the seller, then a counter, if the title is taken.
  let slug = base;
  for (let n = 1; (await db.collection("products").doc(slug).get()).exists; n++) slug = `${base}-${account.seller}${n > 1 ? `-${n}` : ""}`.slice(0, 120);
  const product: Product = clean({
    ...input,
    id: slug,
    slug,
    seller: account.seller,
    icon: cat.subcategories?.find((s) => s.slug === input.subcategory)?.icon ?? cat.icon,
    tint: cat.tint,
    tags: ["new"],
    rating: 0,
    reviewCount: 0,
    listingStatus: "active",
    createdAt: Date.now(),
  });
  await db.collection("products").doc(slug).create(product);
  return Response.json({ ok: true, slug });
}

async function updateListing(request: Request, body: Record<string, unknown>) {
  const { account } = await requireSeller(request);
  const id = typeof body.productId === "string" ? body.productId : "";
  if (!id) throw new MarketplaceError("Missing product.");
  const ref = adminDb().collection("products").doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const p = snap.data() as Product | undefined;
    if (!p || p.seller !== account.seller) throw new MarketplaceError("That listing isn't yours.", 403);
    tx.update(ref, { ...validateListingUpdate(body, p.variants), updatedAt: Date.now() });
  });
  return Response.json({ ok: true });
}

async function ship(request: Request, body: Record<string, unknown>) {
  const { account } = await requireSeller(request);
  const id = typeof body.sellerOrderId === "string" ? body.sellerOrderId : "";
  const tracking = validateTracking(body);
  const ref = adminDb().collection("sellerOrders").doc(id || "-");
  await adminDb().runTransaction(async (tx) => {
    const so = (await tx.get(ref)).data() as SellerOrder | undefined;
    if (!so || so.seller !== account.seller) throw new MarketplaceError("Order not found.", 404);
    if (so.status !== "awaiting_shipment" && so.status !== "shipped") throw new MarketplaceError(`This order is ${so.status.replace("_", " ")}.`, 409);
    tx.update(ref, { ...tracking, status: "shipped", shippedAt: so.shippedAt ?? Date.now() });
  });
  // Sellers are paid once they've shipped.
  const payout = await releasePayout(ref);
  return Response.json({ ok: true, payout });
}

async function decideReturn(request: Request, body: Record<string, unknown>) {
  const { account } = await requireSeller(request);
  const id = typeof body.returnId === "string" ? body.returnId : "";
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!decision) throw new MarketplaceError("Choose approve or reject.");
  if (decision === "reject" && note.length < 5) throw new MarketplaceError("Tell the customer why (it's shown to them and to Dolgers if they escalate).");
  const ref = adminDb().collection("returns").doc(id || "-");
  const status = await adminDb().runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as ReturnRequest | undefined;
    if (!r || r.seller !== account.seller) throw new MarketplaceError("Return not found.", 404);
    const next = nextReturnStatus(r.status, "seller", decision);
    tx.update(ref, { status: next, sellerNote: note, updatedAt: Date.now() });
    return next;
  });
  if (status === "approved") await refundReturn(ref);
  return Response.json({ ok: true, status });
}

async function answer(request: Request, body: Record<string, unknown>) {
  const { account } = await requireSeller(request);
  const { questionId, answer: text } = validateAnswer(body);
  const db = adminDb();
  const qRef = db.collection("questions").doc(questionId);
  await db.runTransaction(async (tx) => {
    const q = (await tx.get(qRef)).data() as Question | undefined;
    if (!q || q.status !== "open") throw new MarketplaceError("Question not found.", 404);
    const pRef = db.collection("products").doc(q.productId);
    const p = (await tx.get(pRef)).data() as Product | undefined;
    // Check the product, not the question: `seller` on a question is whatever the asker's browser sent.
    if (!p || p.seller !== account.seller) throw new MarketplaceError("That question isn't about one of your listings.", 403);
    tx.update(pRef, {
      qa: FieldValue.arrayUnion({ q: q.question, a: text, by: "seller", date: new Date().toISOString().slice(0, 10) }),
    });
    tx.update(qRef, { status: "answered" });
  });
  return Response.json({ ok: true });
}

import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import {
  SIZE_LABELS,
  skuFor,
  slugify,
  vendorActionSchema,
  type Category,
  type InventoryRecord,
  type Product,
  type ProductInput,
  type ReturnRequest,
  type Vendor,
  type VendorApplication,
  type VendorOrder,
  type VendorPrivate,
} from '@dolgers/shared';
import { randomBytes } from 'node:crypto';
import { audit } from './lib/audit.ts';
import { db, now, storage } from './lib/firebase.ts';
import { parse, rateLimit, requireAuth, requireVendor, type Caller } from './lib/guard.ts';
import { queueMail } from './lib/mail.ts';
import { payVendor, refundVendorOrder, updateOrderShippingStatus } from './lib/orders.ts';
import { ENFORCE_APP_CHECK, REGION, SITE_URL, STRIPE_SECRET_KEY } from './lib/params.ts';
import { revalidate } from './lib/revalidate.ts';
import { stripe } from './lib/stripe.ts';

type VendorCaller = Caller & { vendorId: string };

/** One callable for every vendor action; `action` picks the handler. */
export const vendorApi = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 20, concurrency: 40 },
  async (req) => {
    const { action, data } = parse(vendorActionSchema, req.data);
    if (action === 'apply') return apply(req, data);

    const caller = requireVendor(req);
    await rateLimit(`vendor:${caller.uid}`, 120, 60);
    const vendor = (await db.collection('vendors').doc(caller.vendorId).get()).data() as Vendor | undefined;
    if (!vendor) throw new HttpsError('not-found', 'Vendor not found.');
    if (vendor.status === 'suspended' && action !== 'dashboardLink') {
      throw new HttpsError('permission-denied', 'This store is suspended. Contact DOLGERS support.');
    }

    switch (action) {
      case 'onboardingLink': return onboardingLink(caller, vendor);
      case 'dashboardLink': return dashboardLink(caller);
      case 'updateProfile': return updateProfile(caller, data);
      case 'upsertProduct': return upsertProduct(caller, vendor, data);
      case 'submitProduct': return submitProduct(caller, data.productId);
      case 'archiveProduct': return archiveProduct(caller, data.productId);
      case 'setStock': return setStock(caller, data.items);
      case 'markShipped': return markShipped(caller, data);
      case 'reviewReturn': return reviewReturn(caller, data);
      case 'refundReturn': return refundReturn(caller, data.returnId);
    }
  },
);

function requireOwner(caller: VendorCaller) {
  if (caller.claims.vendorRole !== 'owner') throw new HttpsError('permission-denied', 'Only the store owner can do this.');
}

async function apply(req: CallableRequest<unknown>, data: Extract<ReturnType<typeof vendorActionSchema.parse>, { action: 'apply' }>['data']) {
  const caller = requireAuth(req);
  if (caller.anonymous || !caller.email) throw new HttpsError('unauthenticated', 'Create an account before applying.');
  if (caller.claims.vendorId) throw new HttpsError('already-exists', 'This account already runs a store.');
  await rateLimit(`apply:${caller.uid}`, 3, 86_400);
  const ref = db.collection('vendorApplications').doc(caller.uid);
  const existing = (await ref.get()).data() as VendorApplication | undefined;
  if (existing && existing.status !== 'rejected') throw new HttpsError('already-exists', 'Your application is already with us.');
  const application: VendorApplication = {
    uid: caller.uid,
    email: caller.email,
    ...data,
    status: 'pending',
    reviewNote: '',
    vendorId: null,
    createdAt: now(),
    reviewedAt: null,
  };
  await ref.set(application);
  await queueMail(caller.email, 'We received your DOLGERS application',
    `Thanks for applying to sell ${data.businessName} on DOLGERS. We review every label by hand and will reply by email.`);
  return { status: 'pending' };
}

async function onboardingLink(caller: VendorCaller, vendor: Vendor) {
  requireOwner(caller);
  const privRef = db.collection('vendorPrivate').doc(caller.vendorId);
  const priv = (await privRef.get()).data() as VendorPrivate;
  let accountId = priv.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create(
      {
        type: 'express',
        country: 'US',
        email: priv.contactEmail || caller.email || undefined,
        capabilities: { transfers: { requested: true } },
        business_profile: { name: vendor.name, product_description: vendor.tagline || 'Clothing and accessories', mcc: '5651' },
        metadata: { vendorId: caller.vendorId },
      },
      { idempotencyKey: `acct-${caller.vendorId}` },
    );
    accountId = account.id;
    await db.collection('stripeAccounts').doc(accountId).set({ vendorId: caller.vendorId });
    await privRef.update({ stripeAccountId: accountId, updatedAt: now() });
  }
  const site = SITE_URL.value();
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${site}/vendor/payouts?refresh=1`,
    return_url: `${site}/vendor/payouts?return=1`,
  });
  return { url: link.url };
}

async function dashboardLink(caller: VendorCaller) {
  const priv = (await db.collection('vendorPrivate').doc(caller.vendorId).get()).data() as VendorPrivate;
  if (!priv.stripeAccountId || !priv.detailsSubmitted) throw new HttpsError('failed-precondition', 'Finish payout setup first.');
  const link = await stripe().accounts.createLoginLink(priv.stripeAccountId);
  return { url: link.url };
}

async function updateProfile(caller: VendorCaller, data: Extract<ReturnType<typeof vendorActionSchema.parse>, { action: 'updateProfile' }>['data']) {
  for (const img of [data.banner, data.storyImage]) if (img) assertOwnImage(img.url, caller.vendorId);
  await db.collection('vendors').doc(caller.vendorId).update({
    tagline: data.tagline,
    storyTitle: data.storyTitle,
    story: data.story,
    banner: data.banner,
    storyImage: data.storyImage,
    facts: { ...data.facts, dispatchDays: [Math.min(...data.facts.dispatchDays), Math.max(...data.facts.dispatchDays)] },
    updatedAt: now(),
  });
  await revalidate([`vendor:${caller.vendorId}`]);
  return { ok: true };
}

/** Only images that went through our upload pipeline (or the bundled placeholders) are allowed. */
function assertOwnImage(url: string, vendorId: string) {
  if (url === '') return;
  const bucket = storage().name;
  const path = `public/vendors/${vendorId}/`;
  const ok = [
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    `http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    `http://localhost:9199/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
  ].some((prefix) => url.startsWith(prefix));
  if (!ok) throw new HttpsError('invalid-argument', 'Images must be uploaded through the dashboard.');
}

function randomSuffix() {
  return randomBytes(3).toString('hex');
}

async function upsertProduct(caller: VendorCaller, vendor: Vendor, input: ProductInput) {
  const category = (await db.collection('categories').doc(input.categoryId).get()).data() as Category | undefined;
  if (!category) throw new HttpsError('invalid-argument', 'Pick a category.');
  if (category.department !== input.department) throw new HttpsError('invalid-argument', 'That category belongs to another department.');
  const allowed = SIZE_LABELS[input.sizeSystem];
  const sizes = input.variants.map((v) => v.size);
  if (sizes.some((s) => !allowed.includes(s))) throw new HttpsError('invalid-argument', `Sizes must be from: ${allowed.join(', ')}.`);
  if (new Set(sizes).size !== sizes.length) throw new HttpsError('invalid-argument', 'Each size can appear only once.');
  for (const img of input.images) assertOwnImage(img.url, caller.vendorId);

  const t = now();
  const productsCol = db.collection('products');
  let ref = input.id ? productsCol.doc(input.id) : productsCol.doc(`${slugify(input.title) || 'product'}-${randomSuffix()}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data() as Product | undefined;
    if (input.id && !existing) throw new HttpsError('not-found', 'Product not found.');
    if (existing && existing.vendorId !== caller.vendorId) throw new HttpsError('permission-denied', 'Not your product.');
    if (!input.id && snap.exists) ref = productsCol.doc(`${slugify(input.title)}-${randomSuffix()}`);

    const variants = input.variants.map((v) => ({
      sku: existing?.variants.find((e) => e.size === v.size)?.sku ?? skuFor(ref.id, v.size),
      size: v.size,
      price: v.price,
      compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
    }));
    const invRefs = variants.map((v) => db.collection('inventory').doc(v.sku));
    const removed = (existing?.variants ?? []).filter((e) => !variants.some((v) => v.sku === e.sku));
    const removedRefs = removed.map((v) => db.collection('inventory').doc(v.sku));
    const invSnaps = invRefs.length || removedRefs.length ? await tx.getAll(...invRefs, ...removedRefs) : [];

    const prices = variants.map((v) => v.price);
    const product: Product = {
      id: ref.id,
      slug: existing?.slug ?? ref.id,
      vendorId: caller.vendorId,
      vendorSlug: vendor.slug,
      vendorName: vendor.name,
      department: input.department,
      categoryId: category.id,
      categoryPath: category.path,
      title: input.title,
      description: input.description,
      composition: input.composition,
      care: input.care,
      fitNote: input.fitNote,
      sizeSystem: input.sizeSystem,
      colour: input.colour,
      images: input.images,
      variants,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      related: input.related.filter((id) => id !== ref.id),
      // Edits keep an approved product live; new products start as drafts.
      status: existing?.status ?? 'draft',
      reviewNote: existing?.reviewNote ?? '',
      featured: existing?.featured ?? false,
      publishedAt: existing?.publishedAt ?? null,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
    tx.set(ref, product);

    variants.forEach((v, i) => {
      const inv = invSnaps[i]?.data() as InventoryRecord | undefined;
      const wanted = input.variants[i].stock;
      const record: InventoryRecord = {
        sku: v.sku,
        productId: ref.id,
        vendorId: caller.vendorId,
        size: v.size,
        onHand: wanted ?? inv?.onHand ?? 0,
        reserved: inv?.reserved ?? 0,
        updatedAt: t,
      };
      tx.set(invRefs[i], record);
    });
    removed.forEach((_, j) => {
      const inv = invSnaps[variants.length + j]?.data() as InventoryRecord | undefined;
      if (!inv) return;
      if (inv.reserved > 0) tx.update(removedRefs[j], { onHand: 0, updatedAt: t });
      else tx.delete(removedRefs[j]);
    });
    return product;
  });

  await audit(caller.uid, input.id ? 'product.update' : 'product.create', result.id, { vendorId: caller.vendorId });
  return { id: result.id, status: result.status };
}

async function ownProduct(caller: VendorCaller, productId: string) {
  const ref = db.collection('products').doc(productId);
  const product = (await ref.get()).data() as Product | undefined;
  if (!product || product.vendorId !== caller.vendorId) throw new HttpsError('not-found', 'Product not found.');
  return { ref, product };
}

async function submitProduct(caller: VendorCaller, productId: string) {
  const { ref, product } = await ownProduct(caller, productId);
  if (!['draft', 'rejected', 'archived'].includes(product.status)) {
    throw new HttpsError('failed-precondition', `This product is ${product.status.replace('_', ' ')}.`);
  }
  if (!product.images.length) throw new HttpsError('failed-precondition', 'Add at least one photo before submitting.');
  const priv = (await db.collection('vendorPrivate').doc(caller.vendorId).get()).data() as VendorPrivate;
  const status = priv.autoApprove ? 'live' : 'in_review';
  await ref.update({ status, reviewNote: '', updatedAt: now(), ...(status === 'live' && !product.publishedAt ? { publishedAt: now() } : {}) });
  return { status };
}

async function archiveProduct(caller: VendorCaller, productId: string) {
  const { ref } = await ownProduct(caller, productId);
  await ref.update({ status: 'archived', updatedAt: now() });
  return { status: 'archived' };
}

async function setStock(caller: VendorCaller, items: { sku: string; onHand: number }[]) {
  const refs = items.map((i) => db.collection('inventory').doc(i.sku));
  await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);
    snaps.forEach((s, i) => {
      const inv = s.data() as InventoryRecord | undefined;
      if (!inv || inv.vendorId !== caller.vendorId) throw new HttpsError('not-found', `Unknown SKU ${items[i].sku}.`);
      tx.update(refs[i], { onHand: items[i].onHand, updatedAt: now() });
    });
  });
  return { ok: true };
}

async function ownVendorOrder(caller: VendorCaller, id: string) {
  const ref = db.collection('vendorOrders').doc(id);
  const vo = (await ref.get()).data() as VendorOrder | undefined;
  if (!vo || vo.vendorId !== caller.vendorId) throw new HttpsError('not-found', 'Order not found.');
  return { ref, vo };
}

async function markShipped(caller: VendorCaller, data: { vendorOrderId: string; carrier: string; number: string; url: string }) {
  const { ref, vo } = await ownVendorOrder(caller, data.vendorOrderId);
  if (vo.status !== 'preparing' && vo.status !== 'shipped') throw new HttpsError('failed-precondition', `This order is ${vo.status}.`);
  const first = vo.status === 'preparing';
  await ref.update({ status: 'shipped', tracking: { carrier: data.carrier, number: data.number, url: data.url }, shippedAt: vo.shippedAt ?? now() });
  if (first) {
    await queueMail(vo.email, `Your items from ${vo.vendorName} have shipped`,
      `Part of your DOLGERS order ${vo.orderNumber} is on its way.\nCarrier: ${data.carrier}\nTracking: ${data.number}${data.url ? `\n${data.url}` : ''}`);
    await updateOrderShippingStatus(vo.orderId);
    await payVendor(vo.id);
  }
  return { ok: true };
}

async function reviewReturn(caller: VendorCaller, data: { returnId: string; approve: boolean; note: string }) {
  const ref = db.collection('returns').doc(data.returnId);
  const ret = (await ref.get()).data() as ReturnRequest | undefined;
  if (!ret || ret.vendorId !== caller.vendorId) throw new HttpsError('not-found', 'Return not found.');
  if (ret.status !== 'requested') throw new HttpsError('failed-precondition', `This return is already ${ret.status}.`);
  await ref.update({ status: data.approve ? 'approved' : 'rejected', note: data.note, updatedAt: now() });
  const order = (await db.collection('orders').doc(ret.orderId).get()).data();
  if (order?.email) {
    await queueMail(order.email as string, `Your return for order ${ret.orderNumber}`,
      data.approve
        ? `Your return has been approved. Please send the items back to the maker; you'll be refunded when they arrive.${data.note ? `\n\n${data.note}` : ''}`
        : `Your return request was not approved.${data.note ? `\n\n${data.note}` : ''}`);
  }
  return { ok: true };
}

async function refundReturn(caller: VendorCaller, returnId: string) {
  const ref = db.collection('returns').doc(returnId);
  const ret = (await ref.get()).data() as ReturnRequest | undefined;
  if (!ret || ret.vendorId !== caller.vendorId) throw new HttpsError('not-found', 'Return not found.');
  if (ret.status !== 'approved') throw new HttpsError('failed-precondition', 'Approve the return before refunding it.');
  try {
    await refundVendorOrder(ret.vendorOrderId, ret.refundAmount, `Return ${ret.id}`, caller.uid);
  } catch (err) {
    throw new HttpsError('failed-precondition', err instanceof Error ? err.message : 'Refund failed.');
  }
  await ref.update({ status: 'refunded', updatedAt: now() });
  return { ok: true };
}

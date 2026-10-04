import { HttpsError, onCall } from 'firebase-functions/https';
import {
  DEFAULT_COMMISSION_BPS,
  adminActionSchema,
  slugify,
  type AdminAction,
  type Category,
  type Product,
  type PromoCode,
  type Vendor,
  type VendorApplication,
  type VendorMember,
  type VendorPrivate,
} from '@dolgers/shared';
import { audit } from './lib/audit.ts';
import { auth, db, now } from './lib/firebase.ts';
import { parse, requireAdmin, type Caller } from './lib/guard.ts';
import { queueMail } from './lib/mail.ts';
import { payVendor, refundVendorOrder } from './lib/orders.ts';
import { ENFORCE_APP_CHECK, REGION, STRIPE_SECRET_KEY, TYPESENSE_ADMIN_KEY } from './lib/params.ts';
import { revalidate } from './lib/revalidate.ts';
import { reindexAll } from './lib/search.ts';

type Data<A extends AdminAction['action']> = Extract<AdminAction, { action: A }>['data'];

/** One callable for every admin action. Every call is written to the audit log. */
export const adminApi = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, TYPESENSE_ADMIN_KEY], enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 5, timeoutSeconds: 300 },
  async (req) => {
    const caller = requireAdmin(req);
    const input = parse(adminActionSchema, req.data);
    const result = await run(caller, input);
    await audit(caller.uid, `admin.${input.action}`, targetOf(input), input.data as Record<string, unknown>);
    return result;
  },
);

function targetOf(input: AdminAction): string {
  const d = input.data as Record<string, unknown>;
  return String(d.uid ?? d.productId ?? d.vendorId ?? d.vendorOrderId ?? d.code ?? d.email ?? d.id ?? input.action);
}

async function run(caller: Caller, input: AdminAction) {
  switch (input.action) {
    case 'reviewApplication': return reviewApplication(input.data);
    case 'setProductStatus': return setProductStatus(input.data);
    case 'updateVendor': return updateVendor(input.data);
    case 'refund':
      try {
        return await refundVendorOrder(input.data.vendorOrderId, input.data.amount, input.data.reason, caller.uid);
      } catch (err) {
        throw new HttpsError('failed-precondition', err instanceof Error ? err.message : 'Refund failed.');
      }
    case 'upsertPromo': return upsertPromo(input.data);
    case 'updateHome':
      await db.collection('content').doc('home').set({ ...input.data, updatedAt: now() });
      await revalidate(['home']);
      return { ok: true };
    case 'upsertCategory': return upsertCategory(input.data);
    case 'setAdmin': return setAdmin(caller, input.data);
    case 'reindexSearch': return { indexed: await reindexAll() };
    case 'retryPayout': return { status: await payVendor(input.data.vendorOrderId) };
  }
}

async function uniqueVendorId(name: string): Promise<string> {
  const base = slugify(name) || 'store';
  for (let i = 0; i < 20; i++) {
    const id = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.collection('vendors').doc(id).get()).exists) return id;
  }
  throw new HttpsError('already-exists', 'Could not find a free store address.');
}

async function reviewApplication(data: Data<'reviewApplication'>) {
  const appRef = db.collection('vendorApplications').doc(data.uid);
  const application = (await appRef.get()).data() as VendorApplication | undefined;
  if (!application) throw new HttpsError('not-found', 'Application not found.');
  if (application.status !== 'pending') throw new HttpsError('failed-precondition', `Already ${application.status}.`);

  if (!data.approve) {
    await appRef.update({ status: 'rejected', reviewNote: data.note, reviewedAt: now() });
    await queueMail(application.email, 'Your DOLGERS application',
      `Thank you for applying. We are not able to offer ${application.businessName} a store right now.${data.note ? `\n\n${data.note}` : ''}`);
    return { status: 'rejected' };
  }

  const vendorId = await uniqueVendorId(application.businessName);
  const t = now();
  const vendor: Vendor = {
    id: vendorId,
    slug: vendorId,
    name: application.businessName,
    tagline: application.description.slice(0, 160),
    story: application.description,
    storyTitle: '',
    facts: { shipsFrom: application.shipsFrom, dispatchDays: [2, 5] },
    departments: application.departments,
    status: 'active',
    followerCount: 0,
    productCount: 0,
    createdAt: t,
    updatedAt: t,
  };
  const priv: VendorPrivate = {
    vendorId,
    ownerUid: application.uid,
    contactEmail: application.email,
    stripeAccountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    commissionBps: data.commissionBps ?? DEFAULT_COMMISSION_BPS,
    autoApprove: false,
    updatedAt: t,
  };
  const member: VendorMember = { uid: application.uid, email: application.email, role: 'owner', addedAt: t };
  const batch = db.batch();
  batch.set(db.collection('vendors').doc(vendorId), vendor);
  batch.set(db.collection('vendorPrivate').doc(vendorId), priv);
  batch.set(db.collection('vendors').doc(vendorId).collection('members').doc(application.uid), member);
  batch.update(appRef, { status: 'approved', reviewNote: data.note, vendorId, reviewedAt: t });
  await batch.commit();

  const user = await auth.getUser(application.uid);
  await auth.setCustomUserClaims(application.uid, { ...(user.customClaims ?? {}), vendorId, vendorRole: 'owner' });
  await queueMail(application.email, 'Welcome to DOLGERS',
    `${application.businessName} is approved. Sign in and open your vendor dashboard to set up payouts and add your first products.`);
  return { status: 'approved', vendorId };
}

async function setProductStatus(data: Data<'setProductStatus'>) {
  const ref = db.collection('products').doc(data.productId);
  const product = (await ref.get()).data() as Product | undefined;
  if (!product) throw new HttpsError('not-found', 'Product not found.');
  await ref.update({
    status: data.status,
    reviewNote: data.note,
    updatedAt: now(),
    ...(data.featured !== undefined ? { featured: data.featured } : {}),
    ...(data.status === 'live' && !product.publishedAt ? { publishedAt: now() } : {}),
  });
  if (product.status === 'in_review' && (data.status === 'live' || data.status === 'rejected')) {
    const priv = (await db.collection('vendorPrivate').doc(product.vendorId).get()).data() as VendorPrivate | undefined;
    if (priv?.contactEmail) {
      await queueMail(priv.contactEmail, `${product.title} was ${data.status === 'live' ? 'approved' : 'not approved'}`,
        data.status === 'live' ? `${product.title} is now live on DOLGERS.` : `${product.title} needs changes before it can go live.${data.note ? `\n\n${data.note}` : ''}`);
    }
  }
  return { ok: true };
}

async function updateVendor(data: Data<'updateVendor'>) {
  const vendorRef = db.collection('vendors').doc(data.vendorId);
  if (!(await vendorRef.get()).exists) throw new HttpsError('not-found', 'Vendor not found.');
  const privUpdate: Record<string, unknown> = { updatedAt: now() };
  if (data.commissionBps !== undefined) privUpdate.commissionBps = data.commissionBps;
  if (data.autoApprove !== undefined) privUpdate.autoApprove = data.autoApprove;
  await db.collection('vendorPrivate').doc(data.vendorId).update(privUpdate);
  if (data.status) {
    await vendorRef.update({ status: data.status, updatedAt: now() });
    if (data.status === 'suspended') {
      // Take the store's products off sale. Reactivating a store does not relist them
      // automatically: an admin or the vendor resubmits each one.
      let more = true;
      while (more) {
        const live = await db.collection('products').where('vendorId', '==', data.vendorId).where('status', '==', 'live').limit(400).get();
        const batch = db.batch();
        live.docs.forEach((d) => batch.update(d.ref, { status: 'suspended', updatedAt: now() }));
        if (!live.empty) await batch.commit();
        more = live.size === 400;
      }
    }
    await revalidate([`vendor:${data.vendorId}`, 'catalog']);
  }
  return { ok: true };
}

async function upsertPromo(data: Data<'upsertPromo'>) {
  const ref = db.collection('promoCodes').doc(data.code);
  const existing = (await ref.get()).data() as PromoCode | undefined;
  const promo: PromoCode = { ...data, redemptions: existing?.redemptions ?? 0, createdAt: existing?.createdAt ?? now() };
  await ref.set(promo);
  return { ok: true };
}

async function upsertCategory(data: Data<'upsertCategory'>) {
  let path: string[];
  let department: Category['department'];
  if (data.parentId) {
    const parent = (await db.collection('categories').doc(data.parentId).get()).data() as Category | undefined;
    if (!parent) throw new HttpsError('not-found', 'Parent category not found.');
    path = [...parent.path, slugify(data.name)];
    department = parent.department;
  } else {
    path = [slugify(data.name)];
    department = path[0] === 'men' || path[0] === 'boys' ? path[0] : null;
  }
  const id = data.id ?? path.join('--');
  const existing = (await db.collection('categories').doc(id).get()).data() as Category | undefined;
  const category: Category = {
    ...(existing ?? {}),
    id,
    slug: existing?.slug ?? path[path.length - 1],
    name: data.name,
    parentId: existing?.parentId ?? data.parentId,
    path: existing?.path ?? path,
    department: existing?.department ?? department,
    description: data.description,
    order: data.order,
  };
  await db.collection('categories').doc(id).set(category);
  await revalidate(['categories']);
  return { id };
}

async function setAdmin(caller: Caller, data: Data<'setAdmin'>) {
  const user = await auth.getUserByEmail(data.email).catch(() => null);
  if (!user) throw new HttpsError('not-found', 'No account with that email.');
  if (user.uid === caller.uid && !data.admin) throw new HttpsError('failed-precondition', 'You cannot remove your own admin access.');
  const claims = { ...(user.customClaims ?? {}) };
  if (data.admin) claims.admin = true;
  else delete claims.admin;
  await auth.setCustomUserClaims(user.uid, claims);
  return { ok: true };
}

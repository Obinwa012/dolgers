// Seeds the demo catalog from the mockup into the Firebase emulators, plus three test accounts.
// Run with the emulators up:  npm run seed
// To seed a real project (catalog only, no test accounts) pass --project <id> --yes-real-project.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { demoCategories, demoHome, demoProducts, demoStock, demoVendors } from '../../packages/shared/src/demo.ts';
import { DEFAULT_COMMISSION_BPS } from '../../packages/shared/src/constants.ts';
import type { InventoryRecord, VendorPrivate } from '../../packages/shared/src/types.ts';

const args = process.argv.slice(2);
const projectArg = args[args.indexOf('--project') + 1];
const real = args.includes('--yes-real-project');
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST || !real;

if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}
const projectId = real ? projectArg : 'demo-dolgers';
if (!projectId) throw new Error('Pass --project <id> with --yes-real-project');

initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();

async function main() {
  const t = Date.now();
  const batch = db.batch();
  for (const c of demoCategories) batch.set(db.collection('categories').doc(c.id), c);
  for (const v of demoVendors) {
    batch.set(db.collection('vendors').doc(v.id), v);
    const priv: VendorPrivate = {
      vendorId: v.id, ownerUid: '', contactEmail: '', stripeAccountId: null, chargesEnabled: false,
      payoutsEnabled: false, detailsSubmitted: false, commissionBps: DEFAULT_COMMISSION_BPS, autoApprove: true, updatedAt: t,
    };
    batch.set(db.collection('vendorPrivate').doc(v.id), priv, { merge: true });
  }
  await batch.commit();

  const stock = demoStock();
  for (const p of demoProducts) {
    const b = db.batch();
    b.set(db.collection('products').doc(p.id), p);
    for (const variant of p.variants) {
      const inv: InventoryRecord = {
        sku: variant.sku, productId: p.id, vendorId: p.vendorId, size: variant.size,
        onHand: stock.get(variant.sku) ?? 0, reserved: 0, updatedAt: t,
      };
      b.set(db.collection('inventory').doc(variant.sku), inv);
    }
    await b.commit();
  }
  await db.collection('content').doc('home').set(demoHome);
  await db.collection('promoCodes').doc('WELCOME10').set({
    code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 0, active: true, startsAt: null, endsAt: null,
    maxRedemptions: null, redemptions: 0, createdAt: t,
  });
  console.log(`Seeded ${demoCategories.length} categories, ${demoVendors.length} vendors, ${demoProducts.length} products.`);

  if (!emulator) return;
  const users = [
    { email: 'admin@dolgers.test', claims: { admin: true } },
    { email: 'vendor@dolgers.test', claims: { vendorId: 'nordhavn', vendorRole: 'owner' } },
    { email: 'shopper@dolgers.test', claims: {} },
  ];
  for (const u of users) {
    const existing = await auth.getUserByEmail(u.email).catch(() => null);
    const user = existing ?? (await auth.createUser({ email: u.email, password: 'password123', emailVerified: true }));
    await auth.setCustomUserClaims(user.uid, u.claims);
    if (u.claims.vendorId) {
      await db.collection('vendorPrivate').doc(u.claims.vendorId).set({ ownerUid: user.uid, contactEmail: u.email }, { merge: true });
      await db.collection('vendors').doc(u.claims.vendorId).collection('members').doc(user.uid)
        .set({ uid: user.uid, email: u.email, role: 'owner', addedAt: t });
    }
  }
  console.log('Test accounts (password "password123"): admin@dolgers.test, vendor@dolgers.test (Nordhavn), shopper@dolgers.test');
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });

// Security rules tests. Run with `npm run test:rules` (starts the Firestore and Storage emulators).
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dolgers',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'categories/men'), { name: 'Men' });
    await setDoc(doc(db, 'vendors/nordhavn'), { name: 'Nordhavn', status: 'active' });
    await setDoc(doc(db, 'vendors/shady'), { name: 'Shady', status: 'suspended' });
    await setDoc(doc(db, 'vendorPrivate/nordhavn'), { stripeAccountId: 'acct_1', commissionBps: 1500 });
    await setDoc(doc(db, 'products/live1'), { vendorId: 'nordhavn', status: 'live', title: 'Coat' });
    await setDoc(doc(db, 'products/draft1'), { vendorId: 'nordhavn', status: 'draft', title: 'Draft' });
    await setDoc(doc(db, 'inventory/SKU1'), { vendorId: 'nordhavn', onHand: 4, reserved: 0 });
    await setDoc(doc(db, 'orders/o1'), { uid: 'alice', totals: { total: 1000 } });
    await setDoc(doc(db, 'vendorOrders/o1_nordhavn'), { uid: 'alice', vendorId: 'nordhavn' });
    await setDoc(doc(db, 'returns/r1'), { uid: 'alice', vendorId: 'nordhavn' });
    await setDoc(doc(db, 'ledger/l1'), { amount: 1000 });
    await setDoc(doc(db, 'promoCodes/WELCOME10'), { type: 'percent', value: 10 });
    await setDoc(doc(db, 'rateLimits/x'), { count: 1 });
    await setDoc(doc(db, 'users/alice'), profile('alice'));
  });
});

const profile = (uid, extra = {}) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: 'A',
  lastName: 'B',
  marketingOptIn: false,
  createdAt: 1,
  ...extra,
});

const anon = () => env.unauthenticatedContext().firestore();
const user = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();
const vendor = (uid = 'vera') => user(uid, { vendorId: 'nordhavn' });
const admin = () => user('root', { admin: true });

describe('public catalog', () => {
  test('anyone can read categories and live products', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'categories/men')));
    await assertSucceeds(getDoc(doc(anon(), 'products/live1')));
  });

  test('nobody can write the catalog from the client', async () => {
    await assertFails(setDoc(doc(admin(), 'categories/x'), { name: 'X' }));
    await assertFails(setDoc(doc(vendor(), 'products/new'), { vendorId: 'nordhavn', status: 'live' }));
    await assertFails(updateDoc(doc(vendor(), 'products/draft1'), { status: 'live' }));
  });

  test('drafts are visible to their vendor and admins only', async () => {
    await assertFails(getDoc(doc(anon(), 'products/draft1')));
    await assertFails(getDoc(doc(user('mallory', { vendorId: 'other' }), 'products/draft1')));
    await assertSucceeds(getDoc(doc(vendor(), 'products/draft1')));
    await assertSucceeds(getDoc(doc(admin(), 'products/draft1')));
  });

  test('listing products must filter to live ones', async () => {
    await assertFails(getDocs(collection(anon(), 'products')));
    await assertSucceeds(getDocs(query(collection(anon(), 'products'), where('status', '==', 'live'))));
  });

  test('suspended vendors are hidden from the public', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'vendors/nordhavn')));
    await assertFails(getDoc(doc(anon(), 'vendors/shady')));
  });
});

describe('vendor private data', () => {
  test('stock and Stripe status are private to the vendor', async () => {
    await assertFails(getDoc(doc(anon(), 'inventory/SKU1')));
    await assertFails(getDoc(doc(user('alice'), 'vendorPrivate/nordhavn')));
    await assertSucceeds(getDoc(doc(vendor(), 'inventory/SKU1')));
    await assertSucceeds(getDoc(doc(vendor(), 'vendorPrivate/nordhavn')));
  });

  test('vendors cannot change their own stock or commission', async () => {
    await assertFails(updateDoc(doc(vendor(), 'inventory/SKU1'), { onHand: 999 }));
    await assertFails(updateDoc(doc(vendor(), 'vendorPrivate/nordhavn'), { commissionBps: 0 }));
  });
});

describe('shopper profile', () => {
  test('a shopper can read and edit only their own profile', async () => {
    await assertSucceeds(getDoc(doc(user('alice'), 'users/alice')));
    await assertFails(getDoc(doc(user('bob'), 'users/alice')));
    await assertSucceeds(updateDoc(doc(user('alice'), 'users/alice'), { firstName: 'Alicia' }));
    await assertFails(updateDoc(doc(user('bob'), 'users/alice'), { firstName: 'Hacked' }));
  });

  test('a shopper cannot grant themselves extra fields or change createdAt', async () => {
    await assertFails(updateDoc(doc(user('alice'), 'users/alice'), { admin: true }));
    await assertFails(updateDoc(doc(user('alice'), 'users/alice'), { createdAt: 99 }));
    await assertFails(setDoc(doc(user('bob'), 'users/bob'), profile('alice')));
    await assertSucceeds(setDoc(doc(user('bob'), 'users/bob'), profile('bob')));
  });

  test('profiles cannot be deleted from the client', async () => {
    await assertFails(deleteDoc(doc(user('alice'), 'users/alice')));
  });

  test('addresses must be valid US addresses', async () => {
    const address = {
      id: 'home', firstName: 'A', lastName: 'B', line1: '1 Main St', line2: '', city: 'Austin',
      state: 'TX', postalCode: '78701', country: 'US', phone: '', isDefault: true,
    };
    await assertSucceeds(setDoc(doc(user('alice'), 'users/alice/addresses/home'), address));
    await assertFails(setDoc(doc(user('alice'), 'users/alice/addresses/home'), { ...address, country: 'CA' }));
    await assertFails(setDoc(doc(user('alice'), 'users/alice/addresses/home'), { ...address, postalCode: 'ABC' }));
    await assertFails(setDoc(doc(user('bob'), 'users/alice/addresses/home'), address));
  });

  test('wishlist entries use the server time and the right product id', async () => {
    await assertSucceeds(setDoc(doc(user('alice'), 'users/alice/wishlist/live1'), { productId: 'live1', addedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(user('alice'), 'users/alice/wishlist/live1'), { productId: 'other', addedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(user('alice'), 'users/alice/wishlist/live1'), { productId: 'live1', addedAt: 5 }));
  });
});

describe('orders and money', () => {
  test('a shopper sees only their own orders', async () => {
    await assertSucceeds(getDoc(doc(user('alice'), 'orders/o1')));
    await assertFails(getDoc(doc(user('bob'), 'orders/o1')));
    await assertFails(getDoc(doc(anon(), 'orders/o1')));
  });

  test('nobody writes orders from the client', async () => {
    await assertFails(updateDoc(doc(user('alice'), 'orders/o1'), { totals: { total: 0 } }));
    await assertFails(setDoc(doc(admin(), 'orders/o2'), { uid: 'root' }));
  });

  test('vendors see their part of an order and their returns', async () => {
    await assertSucceeds(getDoc(doc(vendor(), 'vendorOrders/o1_nordhavn')));
    await assertSucceeds(getDoc(doc(vendor(), 'returns/r1')));
    await assertFails(getDoc(doc(user('m', { vendorId: 'other' }), 'vendorOrders/o1_nordhavn')));
    await assertFails(updateDoc(doc(vendor(), 'vendorOrders/o1_nordhavn'), { status: 'shipped' }));
  });

  test('ledger and promo codes are admin-read only', async () => {
    await assertFails(getDoc(doc(vendor(), 'ledger/l1')));
    await assertFails(getDoc(doc(user('alice'), 'promoCodes/WELCOME10')));
    await assertSucceeds(getDoc(doc(admin(), 'ledger/l1')));
    await assertFails(setDoc(doc(admin(), 'promoCodes/FREE'), { type: 'percent', value: 100 }));
  });

  test('anything unlisted is closed', async () => {
    await assertFails(getDoc(doc(admin(), 'rateLimits/x')));
    await assertFails(setDoc(doc(user('alice'), 'stripeEvents/evt'), {}));
  });
});

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dolgers',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'products/ae-1'), { status: 'live', title: 'Live' });
    await setDoc(doc(db, 'products/ae-2'), { status: 'pending_review', title: 'Held' });
    await setDoc(doc(db, 'vetting/ae-1'), { decision: 'import' });
    await setDoc(doc(db, 'config/aliexpress'), { accessToken: 'secret' });
    await setDoc(doc(db, 'config/pipeline'), { maxProblemRate: 0.025 });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const shopper = () => env.authenticatedContext('u1').firestore();
const admin = () => env.authenticatedContext('a1', { admin: true }).firestore();

test('anyone can read a live product', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'products/ae-1')));
});
test('nobody but admins can read a held product', async () => {
  await assertFails(getDoc(doc(anon(), 'products/ae-2')));
  await assertFails(getDoc(doc(shopper(), 'products/ae-2')));
  await assertSucceeds(getDoc(doc(admin(), 'products/ae-2')));
});
test('listing products must be limited to live ones for shoppers', async () => {
  await assertSucceeds(getDocs(query(collection(anon(), 'products'), where('status', '==', 'live'))));
  await assertFails(getDocs(collection(anon(), 'products')));
});
test('clients cannot write products', async () => {
  await assertFails(setDoc(doc(admin(), 'products/ae-3'), { status: 'live' }));
});
test('decision records are admin-only', async () => {
  await assertFails(getDoc(doc(shopper(), 'vetting/ae-1')));
  await assertSucceeds(getDoc(doc(admin(), 'vetting/ae-1')));
});
test('API tokens are never readable from a client', async () => {
  await assertFails(getDoc(doc(admin(), 'config/aliexpress')));
  await assertSucceeds(getDoc(doc(admin(), 'config/pipeline')));
});

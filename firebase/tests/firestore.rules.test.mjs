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
    await setDoc(doc(db, 'config/secrets'), { aeAppSecret: 'secret' });
    await setDoc(doc(db, 'users/a1'), { admin: true });
    await setDoc(doc(db, 'sessions/t'), { expiresAt: 1 });
    await setDoc(doc(db, 'config/pipeline'), { maxProblemRate: 0.025 });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const user = () => env.authenticatedContext('u1').firestore();
const claimAdmin = () => env.authenticatedContext('a1', { admin: true }).firestore();

test('anyone can read a live product', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'products/ae-1')));
});
test('nobody can read a held product from a browser', async () => {
  await assertFails(getDoc(doc(anon(), 'products/ae-2')));
  await assertFails(getDoc(doc(user(), 'products/ae-2')));
  await assertFails(getDoc(doc(claimAdmin(), 'products/ae-2')));
});
test('listing products must be limited to live ones', async () => {
  await assertSucceeds(getDocs(query(collection(anon(), 'products'), where('status', '==', 'live'))));
  await assertFails(getDocs(collection(anon(), 'products')));
});
test('clients cannot write products', async () => {
  await assertFails(setDoc(doc(claimAdmin(), 'products/ae-3'), { status: 'live' }));
});
test('private collections are closed to every client', async () => {
  for (const path of ['vetting/ae-1', 'config/pipeline', 'config/secrets', 'users/a1', 'sessions/t']) {
    await assertFails(getDoc(doc(claimAdmin(), path)));
    await assertFails(getDoc(doc(user(), path)));
  }
});
test('nobody can make themselves an admin', async () => {
  await assertFails(setDoc(doc(user(), 'users/u1'), { admin: true }));
});

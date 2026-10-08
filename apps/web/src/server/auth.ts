import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from './firebase.ts';

/**
 * Admin sessions. Sign-in is Firebase Authentication (email and password); the server checks the
 * ID token once and then keeps its own session: sessions/{token} in Firestore and an httpOnly
 * cookie. users/{uid}.admin == true marks an admin, and is checked on every request so removing
 * an admin takes effect at once. The very first account to sign in becomes the first admin.
 */
export const COOKIE_NAME = 'dolgers_admin_session';
export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export interface Admin {
  uid: string;
  email: string;
}

interface SessionDoc {
  uid?: string;
  email?: string;
  createdAt: number;
  expiresAt: number;
}

export async function createSession(admin: Admin): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const doc: SessionDoc = { ...admin, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  await db().collection('sessions').doc(token).set(doc);
  return token;
}

export async function destroySession(token: string) {
  await db().collection('sessions').doc(token).delete().catch(() => {});
}

/** The signed-in admin, or null. Checked once per request however many components ask. */
export const currentAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const snap = await db().collection('sessions').doc(token).get();
  const s = snap.data() as SessionDoc | undefined;
  if (!s || s.expiresAt < Date.now() || !s.uid) {
    if (snap.exists) await snap.ref.delete().catch(() => {});
    return null;
  }
  const user = (await db().collection('users').doc(s.uid).get()).data() as { admin?: boolean } | undefined;
  if (user?.admin !== true) return null;
  return { uid: s.uid, email: s.email ?? '' };
});

/**
 * For pages: sends anyone who isn't a signed-in admin to /login. Every page calls this itself;
 * the layout's check alone isn't enough, because layouts don't re-run on client navigation.
 */
export async function requireAdmin(): Promise<Admin> {
  const a = await currentAdmin();
  if (!a) redirect('/login');
  return a;
}

/** For server actions and route handlers. */
export async function adminOrThrow(): Promise<Admin> {
  const a = await currentAdmin();
  if (!a) throw new Error('Your session has ended. Sign in again.');
  return a;
}

export async function listAdmins(): Promise<{ uid: string; email: string; createdAt: number | null }[]> {
  const snap = await db().collection('users').where('admin', '==', true).limit(50).get();
  return snap.docs.map((d) => {
    const x = d.data() as { email?: string; createdAt?: number };
    return { uid: d.id, email: x.email ?? '', createdAt: x.createdAt ?? null };
  });
}

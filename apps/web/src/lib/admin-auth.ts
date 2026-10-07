import 'server-only';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverDb } from './server/firebase-admin';

const COOKIE_NAME = 'dolgers_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** UIDs from the users collection carrying admin=true. */
export async function getAdminUids(): Promise<string[]> {
  const db = serverDb();
  if (!db) return [];
  const snap = await db.collection('users').where('admin', '==', true).limit(25).get();
  return snap.docs.map((d) => d.id);
}

/** All admin user docs for display. */
export async function getAdminUsers(): Promise<{ uid: string; email: string }[]> {
  const db = serverDb();
  if (!db) return [];
  const snap = await db.collection('users').where('admin', '==', true).limit(25).get();
  return snap.docs.map((d) => ({
    uid: d.id,
    email: String((d.data() as { email?: string }).email ?? ''),
  }));
}

/** Create a server-side session doc; returns the token to store in the cookie. */
export async function createAdminSession(): Promise<string> {
  const db = serverDb();
  if (!db) throw new Error('Database unavailable — cannot create a session.');
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await db
    .collection('sessions')
    .doc(token)
    .set({ createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export async function destroyAdminSession(token: string): Promise<void> {
  const db = serverDb();
  if (!db) return;
  await db.collection('sessions').doc(token).delete().catch(() => {});
}

/** True when the request carries a live admin session. Cleans up expired docs. */
export async function isAdmin(): Promise<boolean> {
  const db = serverDb();
  if (!db) return false;
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE_NAME)?.value;
  } catch {
    return false;
  }
  if (!token) return false;
  try {
    const snap = await db.collection('sessions').doc(token).get();
    const data = snap.data() as { expiresAt?: number } | undefined;
    if (!data || typeof data.expiresAt !== 'number' || data.expiresAt < Date.now()) {
      await snap.ref.delete().catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Page-level guard: sends visitors to /login. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect('/login');
}

/** Route-level guard: returns an error Response when not admin, else null. */
export async function requireAdminRoute(): Promise<Response | null> {
  if (!(await isAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME, SESSION_TTL_MS };

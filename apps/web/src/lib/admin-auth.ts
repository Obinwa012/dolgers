import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverDb } from './server/firebase-admin';

const COOKIE_NAME = 'dolgers_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function parseHash(stored: string): { n: number; salt: string; hex: string } | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return null;
  const n = parseInt(parts[1], 10);
  if (!Number.isFinite(n)) return null;
  return { n, salt: parts[2], hex: parts[3] };
}

/** Constant-time password check against ADMIN_PASSWORD_HASH (scrypt$N$salt$hex). */
export function verifyAdminPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH ?? '';
  if (!stored || !password) return false;
  try {
    const parsed = parseHash(stored);
    if (!parsed) return false;
    const derived = scryptSync(password, parsed.salt, 32, { N: parsed.n, r: 8, p: 1 });
    const expected = Buffer.from(parsed.hex, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
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

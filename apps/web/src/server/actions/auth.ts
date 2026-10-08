'use server';

import { cookies } from 'next/headers';
import { adminOrThrow, COOKIE_NAME, createSession, destroySession, listAdmins, SESSION_TTL_MS } from '../auth.ts';
import { adminAuth, db } from '../firebase.ts';
import { fail, type Result } from './result.ts';

/** Exchanges a Firebase ID token for an admin session cookie. */
export async function signIn(idToken: string): Promise<Result> {
  try {
    let uid: string;
    let email: string;
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email ?? '';
    } catch {
      return { ok: false, error: 'Sign-in could not be verified. Try again.' };
    }
    const ref = db().collection('users').doc(uid);
    const snap = await ref.get();
    let isAdmin = (snap.data() as { admin?: boolean } | undefined)?.admin === true;
    if (!isAdmin) {
      // Bootstrap: while no admin exists, the first account to sign in becomes the admin. The
      // marker document makes this happen once, even if two people sign in at the same moment.
      const marker = db().doc('config/bootstrap');
      isAdmin = await db().runTransaction(async (tx) => {
        const [done, admins] = await Promise.all([tx.get(marker), tx.get(db().collection('users').where('admin', '==', true).limit(1))]);
        if (done.exists || !admins.empty) return false;
        tx.create(marker, { uid, email, at: Date.now() });
        tx.set(ref, { email, admin: true, createdAt: Date.now() }, { merge: true });
        return true;
      });
    }
    if (!isAdmin) return { ok: false, error: 'This account is not a DOLGERS admin.' };
    const token = await createSession({ uid, email });
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  jar.delete(COOKIE_NAME);
}

/** Makes an account an admin, creating it with the given password if it doesn't exist yet. */
export async function addAdmin(email: string, password: string): Promise<Result> {
  try {
    await adminOrThrow();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
    let uid: string;
    const existing = await adminAuth().getUserByEmail(clean).catch(() => null);
    if (existing && existing.emailVerified) {
      uid = existing.uid;
    } else {
      // A new account, or one whose owner never proved the address (anyone can register an email
      // they don't own): set the password you give, so only the person you hand it to can sign in.
      if (password.length < 8) {
        return { ok: false, error: existing ? 'That account’s email isn’t verified. Give a password (8+ characters) to set for it.' : 'No account uses that email yet. Give a password of at least 8 characters to create one.' };
      }
      uid = existing ? (await adminAuth().updateUser(existing.uid, { password })).uid : (await adminAuth().createUser({ email: clean, password })).uid;
      if (existing) await adminAuth().revokeRefreshTokens(uid);
    }
    await db().collection('users').doc(uid).set({ email: clean, admin: true, createdAt: Date.now() }, { merge: true });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAdmin(uid: string): Promise<Result> {
  try {
    const me = await adminOrThrow();
    if (uid === me.uid) return { ok: false, error: "You can't remove yourself." };
    if ((await listAdmins()).length <= 1) return { ok: false, error: 'There must be at least one admin.' };
    await db().collection('users').doc(uid).set({ admin: false }, { merge: true });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

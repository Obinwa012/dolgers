import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createAdminSession,
  getAdminUids,
} from '@/lib/admin-auth';
import { serverDb } from '@/lib/server/firebase-admin';

/**
 * Exchange a Firebase ID token for an admin session cookie.
 * The users collection is the source of truth for who is admin:
 * `users/{uid}` = { email, admin: boolean }.
 * Bootstrap: if no admin exists yet, the first login promotes itself.
 */
export async function POST(req: Request) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.idToken) {
    return NextResponse.json({ error: 'Missing ID token.' }, { status: 400 });
  }

  const db = serverDb();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 500 });
  }

  let uid: string;
  let email: string;
  try {
    serverDb(); // ensure the Admin SDK app is initialized
    const decoded = await getAuth().verifyIdToken(body.idToken);
    uid = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid or expired sign-in. Try again.' }, { status: 401 });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    let isAdmin = (snap.data() as { admin?: boolean } | undefined)?.admin === true;

    if (!isAdmin) {
      // Bootstrap: the first admin assigns itself. After one admin exists,
      // only an existing admin's doc carries admin=true.
      const admins = await getAdminUids();
      if (admins.length === 0) {
        await userRef.set({ email, admin: true, createdAt: Date.now() }, { merge: true });
        isAdmin = true;
      } else if (!snap.exists) {
        await userRef.set({ email, admin: false, createdAt: Date.now() }, { merge: true });
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'This account is not an admin.' }, { status: 403 });
    }

    const token = await createAdminSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not create a session.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdminRoute } from '@/lib/admin-auth';
import { buildAuthorizeUrl, getAeCreds } from '@/lib/ae';
import { serverDb } from '@/lib/server/firebase-admin';

function siteUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://dolgers--dolgers.us-central1.hosted.app'
  ).replace(/\/$/, '');
}

/** Step 1 of AliExpress OAuth: redirect the admin to authorize the app. */
export async function GET() {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const creds = await getAeCreds();
  if (!creds?.appKey || !creds?.appSecret) {
    return NextResponse.json({ error: 'Save the app key + secret first.' }, { status: 400 });
  }
  const db = serverDb();
  if (!db) return NextResponse.json({ error: 'Database unavailable.' }, { status: 500 });

  // Keep the secret server-side: stash it under the one-time state value.
  const state = randomBytes(16).toString('hex');
  await db.collection('oauth_states').doc(state).set({
    appKey: creds.appKey,
    appSecret: creds.appSecret,
    createdAt: Date.now(),
  });

  const res = NextResponse.redirect(
    buildAuthorizeUrl(creds.appKey, `${siteUrl()}/api/auth/ae/callback`, state),
  );
  res.cookies.set('ae_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}

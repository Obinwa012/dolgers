import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminRoute } from '@/lib/admin-auth';
import { exchangeCodeForTokens } from '@/lib/ae';
import { serverDb } from '@/lib/server/firebase-admin';

function settingsUrl(ok: boolean, msg: string): string {
  const base =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://dolgers--dolgers.us-central1.hosted.app';
  return `${base.replace(/\/$/, '')}/settings?${ok ? 'connected=1' : `error=${encodeURIComponent(msg)}`}`;
}

/** Step 2 of AliExpress OAuth: exchange the code for tokens and store them. */
export async function GET(req: Request) {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const db = serverDb();
  if (!db) return NextResponse.redirect(settingsUrl(false, 'Database unavailable.'));

  const url = new URL(req.url);
  const code = url.searchParams.get('code') ?? '';
  const returnedState = url.searchParams.get('state') ?? '';
  let cookieState: string | undefined;
  try {
    cookieState = (await cookies()).get('ae_oauth_state')?.value;
  } catch { /* ignore */ }

  if (!code) return NextResponse.redirect(settingsUrl(false, 'No code returned.'));
  if (!returnedState || returnedState !== cookieState) {
    return NextResponse.redirect(settingsUrl(false, 'State mismatch — try again.'));
  }

  const stateDoc = await db.collection('oauth_states').doc(returnedState).get();
  const s = stateDoc.data() as { appKey?: string; appSecret?: string } | undefined;
  await stateDoc.ref.delete().catch(() => {});
  if (!s?.appKey || !s?.appSecret) {
    return NextResponse.redirect(settingsUrl(false, 'Session expired — try again.'));
  }

  try {
    await exchangeCodeForTokens({ appKey: s.appKey, appSecret: s.appSecret }, code);
    const res = NextResponse.redirect(settingsUrl(true, ''));
    res.cookies.set('ae_oauth_state', '', { path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    return NextResponse.redirect(
      settingsUrl(false, e instanceof Error ? e.message : 'Code exchange failed.'),
    );
  }
}

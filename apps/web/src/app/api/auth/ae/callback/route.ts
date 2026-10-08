import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AliExpressClient } from '@/core/aliexpress/client.ts';
import { currentAdmin } from '@/server/auth.ts';
import { siteUrl } from '@/server/context.ts';
import { db, repo } from '@/server/firebase.ts';

/** AliExpress sends the admin back here after they approve DOLGERS; the code becomes tokens. */
export async function GET(req: Request) {
  const back = (ok: boolean, msg: string) =>
    NextResponse.redirect(`${siteUrl()}/settings?tab=aliexpress&${ok ? 'connected=1' : `error=${encodeURIComponent(msg)}`}`);

  if (!(await currentAdmin())) return NextResponse.redirect(`${siteUrl()}/login`);
  const url = new URL(req.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const jar = await cookies();
  const expected = jar.get('ae_oauth_state')?.value;
  jar.delete('ae_oauth_state');
  if (!code) return back(false, url.searchParams.get('error_description') ?? 'AliExpress did not return a code.');
  if (!state || state !== expected) return back(false, 'The sign-in link expired or was opened in another browser. Try Connect again.');

  const ref = db().collection('oauth_states').doc(state);
  const stateDoc = await ref.get();
  await ref.delete().catch(() => {});
  if (!stateDoc.exists || Date.now() - Number(stateDoc.data()?.createdAt ?? 0) > 10 * 60_000) {
    return back(false, 'The sign-in link expired. Try Connect again.');
  }
  const s = await repo().secrets();
  if (!s.aeAppKey || !s.aeAppSecret) return back(false, 'Save the app key and secret first.');
  try {
    const client = new AliExpressClient({ appKey: s.aeAppKey, appSecret: s.aeAppSecret, tokens: repo().tokenStore() });
    await client.exchangeCode(code);
    return back(true, '');
  } catch (e) {
    return back(false, e instanceof Error ? e.message : 'Code exchange failed.');
  }
}

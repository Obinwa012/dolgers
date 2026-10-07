import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-auth';
import { saveAeCreds } from '@/lib/ae';

/** Save the AliExpress app key/secret. Values are write-only; never returned. */
export async function POST(req: Request) {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  let body: { appKey?: string; appSecret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const patch: Record<string, string> = {};
  if (body.appKey?.trim()) patch.aeAppKey = body.appKey.trim();
  if (body.appSecret?.trim()) patch.aeAppSecret = body.appSecret.trim();
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }
  try {
    await saveAeCreds(patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed.' },
      { status: 500 },
    );
  }
}

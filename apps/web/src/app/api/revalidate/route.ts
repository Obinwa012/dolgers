import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

// Called by Cloud Functions when catalog data changes. The body is signed with a shared secret;
// requests older than five minutes are rejected so a captured request cannot be replayed later.
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const body = await req.text();
  const given = Buffer.from(req.headers.get('x-dolgers-signature') ?? '', 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }
  let payload: { tags?: unknown; at?: unknown };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }
  if (typeof payload.at !== 'number' || Math.abs(Date.now() - payload.at) > 5 * 60_000) {
    return NextResponse.json({ error: 'stale' }, { status: 401 });
  }
  const tags = Array.isArray(payload.tags) ? payload.tags.filter((t): t is string => typeof t === 'string' && t.length <= 200).slice(0, 50) : [];
  for (const tag of tags) revalidateTag(tag, 'max');
  if (tags.length) revalidateTag('search', 'max');
  return NextResponse.json({ revalidated: tags });
}

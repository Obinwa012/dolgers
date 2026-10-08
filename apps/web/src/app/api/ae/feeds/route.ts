import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-auth';
import { getAeCreds, aeFeedNames, aeRecommendFeed } from '@/lib/ae';

/** GET — list the dropship feeds this app can see. */
export async function GET() {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const creds = await getAeCreds();
  if (!creds) return NextResponse.json({ error: 'AliExpress not configured.' }, { status: 400 });
  try {
    const r = await aeFeedNames(creds);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Feed list failed.' }, { status: 502 });
  }
}

/** POST { feedName, categoryId?, page? } — preview products from one feed. */
export async function POST(req: Request) {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const creds = await getAeCreds();
  if (!creds) return NextResponse.json({ error: 'AliExpress not configured.' }, { status: 400 });
  let body: { feedName?: string; categoryId?: string; page?: number };
  try {
    body = (await req.json()) as { feedName?: string; categoryId?: string; page?: number };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.feedName) return NextResponse.json({ error: 'feedName required.' }, { status: 400 });
  try {
    const r = await aeRecommendFeed(creds, {
      feedName: body.feedName,
      categoryId: body.categoryId || undefined,
      pageNo: body.page && body.page > 0 ? body.page : 1,
      pageSize: 20,
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Feed read failed.' }, { status: 502 });
  }
}

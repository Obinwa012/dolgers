import { NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { requireAdminRoute } from '@/lib/admin-auth';
import { serverDb } from '@/lib/server/firebase-admin';

/** List staged products, optionally filtered by category. */
export async function GET(req: Request) {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const db = serverDb();
  if (!db) return NextResponse.json({ error: 'Database unavailable.' }, { status: 500 });

  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId') ?? '';
  try {
    let q: Query = db.collection('staging');
    if (categoryId) q = q.where('categoryId', '==', categoryId);
    const snap = await q.orderBy('createdAt', 'desc').limit(200).get();
    return NextResponse.json({
      products: snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          aeProductId: v.aeProductId,
          title: v.title,
          image: v.image,
          priceMin: v.priceMin ?? null,
          priceMax: v.priceMax ?? null,
          currency: v.currency ?? 'USD',
          rating: v.rating ?? null,
          orders: v.orders ?? null,
          freightOptions: v.freightOptions ?? [],
          shipsFromUSA: !!v.shipsFromUSA,
          stage1Status: v.stage1Status ?? '',
          stage1Note: v.stage1Note ?? '',
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Read failed.' },
      { status: 500 },
    );
  }
}

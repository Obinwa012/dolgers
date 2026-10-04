import { NextResponse, type NextRequest } from 'next/server';
import { isNew } from '@dolgers/shared';
import type { CardProduct } from '@/components/ProductCard';
import { getProductsByIds } from '@/lib/server/catalog';
import { allow } from '@/lib/server/rate-limit';

const ID = /^[A-Za-z0-9_-]{1,128}$/;

// Card data for a list of live products, e.g. the wishlist. Read-only and cached at the CDN;
// hidden or unknown ids are simply left out.
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!allow(`products:${ip}`, 60, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const ids = [...new Set((req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => ID.test(s)))].slice(0, 30);
  if (!ids.length) return NextResponse.json({ products: [] });

  const now = Date.now();
  const products: CardProduct[] = (await getProductsByIds(ids)).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    vendorName: p.vendorName,
    price: p.priceMin,
    priceMax: p.priceMax,
    image: p.images[0] ?? null,
    isNew: isNew(p.publishedAt, now),
  }));
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}

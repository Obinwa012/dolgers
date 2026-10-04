import { NextResponse } from 'next/server';
import { getAvailability, getProduct } from '@/lib/server/catalog';

// Which sizes can be bought right now. Product pages are cached; this small call keeps sold-out
// states accurate. A 15-second CDN cache absorbs bursts on a popular product.
export async function GET(_req: Request, ctx: RouteContext<'/api/availability/[slug]'>) {
  const { slug } = await ctx.params;
  const product = await getProduct(slug);
  if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const sizes = await getAvailability(product);
  return NextResponse.json({ sizes }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } });
}

import { NextResponse, type NextRequest } from 'next/server';
import { cartQuoteSchema, priceCart, type InventoryRecord, type Product, type PromoCode } from '@dolgers/shared';
import { demoProducts, demoStock } from '@dolgers/shared/demo';
import { serverDb } from '@/lib/server/firebase-admin';
import { allow } from '@/lib/server/rate-limit';

// Prices the bag from the database for display. The real charge is priced again, inside a
// transaction, by the createCheckout function; this endpoint cannot change anything.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!allow(`quote:${ip}`, 60, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const parsed = cartQuoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid bag' }, { status: 400 });
  const input = parsed.data;
  const skus = [...new Set(input.lines.map((l) => l.sku))];
  const db = serverDb();

  let products = new Map<string, Product>();
  const stock = new Map<string, number>();
  let promo: PromoCode | null = null;

  if (!db) {
    const demo = demoStock();
    for (const p of demoProducts) if (p.variants.some((v) => skus.includes(v.sku))) products.set(p.id, p);
    for (const s of skus) stock.set(s, demo.get(s) ?? 0);
  } else if (skus.length) {
    const invSnaps = await db.getAll(...skus.map((s) => db.collection('inventory').doc(s)));
    const productIds = new Set<string>();
    for (const s of invSnaps) {
      if (!s.exists) continue;
      const inv = s.data() as InventoryRecord;
      stock.set(s.id, inv.onHand - inv.reserved);
      productIds.add(inv.productId);
    }
    if (productIds.size) {
      const snaps = await db.getAll(...[...productIds].map((id) => db.collection('products').doc(id)));
      products = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, s.data() as Product]));
    }
    if (input.promoCode) {
      promo = ((await db.collection('promoCodes').doc(input.promoCode.trim().toUpperCase()).get()).data() as PromoCode | undefined) ?? null;
    }
  }

  const priced = priceCart({ lines: input.lines, products, stock, delivery: input.delivery, promo, promoCodeInput: input.promoCode, now: Date.now() });
  return NextResponse.json(priced, { headers: { 'Cache-Control': 'no-store' } });
}

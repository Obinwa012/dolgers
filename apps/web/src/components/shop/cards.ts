import { isNew, type Product, type SearchDoc } from '@dolgers/shared';
import type { CardProduct } from '@/components/ProductCard';

/** Current time for "NEW" badges, read once per render outside component bodies. */
export function nowMs(): number {
  return Date.now();
}

export function productToCard(p: Product, now: number, eyebrow?: string): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    vendorName: p.vendorName,
    price: p.priceMin,
    priceMax: p.priceMax,
    image: p.images[0] ?? null,
    isNew: isNew(p.publishedAt, now),
    eyebrow,
  };
}

export function docToCard(d: SearchDoc, eyebrow?: string): CardProduct {
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    vendorName: d.vendorName,
    price: d.price,
    priceMax: d.priceMax,
    image: d.image,
    isNew: d.isNew,
    eyebrow,
  };
}

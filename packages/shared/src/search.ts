import { NEW_WINDOW_DAYS } from './constants.ts';
import { categoryIdsFromPath } from './demo.ts';
import type { Millis, Product, SearchDoc } from './types.ts';

export function isNew(publishedAt: Millis | null, now: Millis): boolean {
  return publishedAt !== null && now - publishedAt < NEW_WINDOW_DAYS * 86_400_000;
}

/** Shape of a live product in the search index. `inStock` lists sizes with units to sell. */
export function toSearchDoc(p: Product, inStock: string[], now: Millis): SearchDoc & { categoryIds: string[] } {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    vendorId: p.vendorId,
    vendorSlug: p.vendorSlug,
    vendorName: p.vendorName,
    department: p.department,
    categoryPath: p.categoryPath,
    categoryIds: categoryIdsFromPath(p.categoryPath),
    categoryLeaf: p.categoryPath[p.categoryPath.length - 1],
    colour: p.colour.name,
    colourHex: p.colour.hex,
    sizes: p.variants.map((v) => v.size),
    sizesInStock: inStock,
    price: p.priceMin,
    priceMax: p.priceMax,
    image: p.images[0] ?? null,
    isNew: isNew(p.publishedAt, now),
    featured: p.featured,
    publishedAt: p.publishedAt ?? 0,
  };
}

export const SORTS = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
} as const;
export type SortKey = keyof typeof SORTS;

export interface SearchQuery {
  q: string;
  categoryId: string | null;
  vendorId: string | null;
  department: string | null;
  sizes: string[];
  colours: string[];
  vendors: string[];
  priceMin: number | null;
  priceMax: number | null;
  newOnly: boolean;
  sort: SortKey;
  page: number;
  perPage: number;
}

export interface Facet {
  value: string;
  count: number;
}

export interface SearchResult {
  hits: (SearchDoc & { categoryIds: string[] })[];
  found: number;
  page: number;
  perPage: number;
  facets: { sizes: Facet[]; colours: Facet[]; vendors: Facet[] };
}

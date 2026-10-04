import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  categoryIdsFromPath,
  type Category,
  type HomeContent,
  type InventoryRecord,
  type Product,
  type Vendor,
} from '@dolgers/shared';
import { demoCategories, demoHome, demoProducts, demoStock, demoVendors } from '@dolgers/shared/demo';
import { serverDb } from './firebase-admin';

// Catalog reads for server components. Each is cached and tagged; Cloud Functions call
// /api/revalidate with the matching tag when the data changes, so a traffic spike is served
// from cache rather than the database.

const HOUR = 3600;

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const db = serverDb();
    if (!db) return demoCategories;
    const snap = await db.collection('categories').get();
    return snap.docs.map((d) => d.data() as Category).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  },
  ['categories'],
  { tags: ['categories'], revalidate: HOUR },
);

export async function getCategoryByPath(path: string[]): Promise<Category | null> {
  const id = path.join('--');
  return (await getCategories()).find((c) => c.id === id) ?? null;
}

export async function getChildCategories(parentId: string | null): Promise<Category[]> {
  return (await getCategories()).filter((c) => c.parentId === parentId);
}

export const getHome = unstable_cache(
  async (): Promise<HomeContent> => {
    const db = serverDb();
    if (!db) return demoHome;
    const snap = await db.collection('content').doc('home').get();
    const home = snap.data() as HomeContent | undefined;
    return home ? { ...home, announcementSlides: home.announcementSlides ?? [], heroSlides: home.heroSlides ?? [] } : demoHome;
  },
  ['home'],
  { tags: ['home'], revalidate: HOUR },
);

export const getVendors = unstable_cache(
  async (): Promise<Vendor[]> => {
    const db = serverDb();
    if (!db) return demoVendors;
    const snap = await db.collection('vendors').where('status', '==', 'active').get();
    return snap.docs.map((d) => d.data() as Vendor).sort((a, b) => a.name.localeCompare(b.name));
  },
  ['vendors'],
  { tags: ['catalog'], revalidate: HOUR },
);

export function getVendor(slug: string): Promise<Vendor | null> {
  return unstable_cache(
    async () => {
      const db = serverDb();
      if (!db) return demoVendors.find((v) => v.slug === slug) ?? null;
      const snap = await db.collection('vendors').where('slug', '==', slug).limit(1).get();
      const v = snap.docs[0]?.data() as Vendor | undefined;
      return v && v.status === 'active' ? v : null;
    },
    ['vendor', slug],
    { tags: [`vendor:${slug}`, 'catalog'], revalidate: HOUR },
  )();
}

export function getProduct(slug: string): Promise<Product | null> {
  return unstable_cache(
    async () => {
      const db = serverDb();
      if (!db) return demoProducts.find((p) => p.slug === slug) ?? null;
      const snap = await db.collection('products').doc(slug).get();
      const p = snap.data() as Product | undefined;
      return p && p.status === 'live' ? p : null;
    },
    ['product', slug],
    { tags: [`product:${slug}`], revalidate: HOUR },
  )();
}

/** Live products by id, in the order given. Missing or hidden ones are skipped. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = [...new Set(ids)].slice(0, 30);
  const products = await Promise.all(unique.map((id) => getProduct(id)));
  return products.filter((p): p is Product => !!p);
}

/** Every live product. Used for the in-memory search fallback and the sitemap. */
export const getAllLiveProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const db = serverDb();
    if (!db) return demoProducts;
    const snap = await db.collection('products').where('status', '==', 'live').orderBy('publishedAt', 'desc').limit(2000).get();
    return snap.docs.map((d) => d.data() as Product);
  },
  ['all-live-products'],
  { tags: ['catalog'], revalidate: 600 },
);

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const home = await getHome();
  if (home.newArrivalIds.length) return (await getProductsByIds(home.newArrivalIds)).slice(0, limit);
  return (await getAllLiveProducts()).slice().sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)).slice(0, limit);
}

export async function getVendorProducts(vendorId: string): Promise<Product[]> {
  return (await getAllLiveProducts()).filter((p) => p.vendorId === vendorId);
}

export function inCategory(p: Product, categoryId: string): boolean {
  return categoryIdsFromPath(p.categoryPath).includes(categoryId);
}

/**
 * SKUs with stock to sell, for the in-memory search fallback (Typesense keeps its own copy).
 * Cached briefly; the product page re-checks live stock before anything is added to the bag.
 */
export const getInStockSkus = unstable_cache(
  async (): Promise<string[]> => {
    const db = serverDb();
    if (!db) return [...demoStock()].filter(([, n]) => n > 0).map(([sku]) => sku);
    const snap = await db.collection('inventory').select('onHand', 'reserved').get();
    return snap.docs.filter((d) => (d.get('onHand') ?? 0) - (d.get('reserved') ?? 0) > 0).map((d) => d.id);
  },
  ['in-stock-skus'],
  { tags: ['stock'], revalidate: 120 },
);

/** Units available to sell per size. Never cached: stock changes with every sale. */
export async function getAvailability(product: Product): Promise<Record<string, boolean>> {
  const db = serverDb();
  const result: Record<string, boolean> = {};
  if (!db) {
    const stock = demoStock();
    for (const v of product.variants) result[v.size] = (stock.get(v.sku) ?? 0) > 0;
    return result;
  }
  const snaps = await db.getAll(...product.variants.map((v) => db.collection('inventory').doc(v.sku)));
  snaps.forEach((s, i) => {
    const inv = s.data() as InventoryRecord | undefined;
    result[product.variants[i].size] = !!inv && inv.onHand - inv.reserved > 0;
  });
  return result;
}

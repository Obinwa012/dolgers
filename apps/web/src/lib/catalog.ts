import 'server-only';
import { cache } from 'react';
import { DEMO_PRODUCTS } from './demo';

/** The public part of a product document, as written by the sourcing pipeline (packages/core). */
export interface Product {
  id: string;
  handle: string;
  status: 'live' | 'pending_review' | 'paused' | 'retired';
  department: 'men' | 'women';
  category: string;
  title: string;
  bullets: string[];
  description: string[];
  faq: { q: string; a: string }[];
  seo: { title: string; metaDescription: string; primaryKeyword: string; secondaryKeywords: string[] };
  images: { url: string; alt: string }[];
  variants: { id: string; color: string; size: string; priceCents: number; inStock: boolean }[];
  colors: string[];
  sizes: string[];
  priceFromCents: number;
  priceToCents: number;
  freeShipping: boolean;
  delivery: { minDays: number | null; maxDays: number | null };
  material: string | null;
  origin: 'Imported';
  sizeChart: {
    fitType: string;
    rows: {
      size: string;
      fitsBody: { measure: string; min: number; max: number }[];
      garment: Record<string, number>;
      usSizeLabel: string;
      confidence: 'high' | 'medium' | 'low';
    }[];
    fitNotes: string[];
  } | null;
  publishedAt: number | null;
}

function projectId(): string | undefined {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    return process.env.FIREBASE_CONFIG ? (JSON.parse(process.env.FIREBASE_CONFIG).projectId as string) : undefined;
  } catch {
    return undefined;
  }
}

/** Server-side Firestore via the hosting service account (read-only access is all this site needs). */
async function db() {
  const id = projectId();
  if (!id) return null;
  const { getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(getApps()[0] ?? initializeApp({ projectId: id }));
}

const useDemo = () => process.env.DOLGERS_DEMO === '1';

/** Every live product, newest first. The catalog is small, so filtering happens here, not in an index. */
export const liveProducts = cache(async (): Promise<Product[]> => {
  if (useDemo()) return DEMO_PRODUCTS;
  const firestore = await db();
  if (!firestore) {
    console.warn('[catalog] no Firebase project configured; showing an empty catalog');
    return [];
  }
  try {
    const snap = await firestore.collection('products').where('status', '==', 'live').get();
    return snap.docs
      .map((d) => d.data() as Product)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  } catch (e) {
    console.error('[catalog] could not read products:', (e as Error).message);
    return [];
  }
});

export async function productByHandle(handle: string): Promise<Product | null> {
  return (await liveProducts()).find((p) => p.handle === handle) ?? null;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function priceLabel(p: Pick<Product, 'priceFromCents' | 'priceToCents'>): string {
  return p.priceFromCents === p.priceToCents
    ? formatPrice(p.priceFromCents)
    : `${formatPrice(p.priceFromCents)} – ${formatPrice(p.priceToCents)}`;
}

export function arrivalLabel(d: Product['delivery']): string | null {
  if (!d.minDays || !d.maxDays) return null;
  return `Arrives in ${d.minDays}–${d.maxDays} days`;
}

export const DEPARTMENTS = { men: "Men's", women: "Women's" } as const;
export type Department = keyof typeof DEPARTMENTS;

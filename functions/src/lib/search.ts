import Typesense from 'typesense';
import { logger } from 'firebase-functions';
import { toSearchDoc, type InventoryRecord, type Product } from '@dolgers/shared';
import { db, now } from './firebase.ts';
import { TYPESENSE_ADMIN_KEY, TYPESENSE_HOST } from './params.ts';

export const PRODUCTS_COLLECTION = 'products';

// Collection definition. Facet fields drive the Shop page filters; sort fields drive "Sort".
export const productsSchema = {
  name: PRODUCTS_COLLECTION,
  enable_nested_fields: true,
  default_sorting_field: 'publishedAt',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'slug', type: 'string', index: false, optional: true },
    { name: 'vendorId', type: 'string', facet: true },
    { name: 'vendorSlug', type: 'string', index: false, optional: true },
    { name: 'vendorName', type: 'string', facet: true },
    { name: 'department', type: 'string', facet: true },
    { name: 'categoryPath', type: 'string[]', facet: true },
    { name: 'categoryIds', type: 'string[]', facet: true },
    { name: 'categoryLeaf', type: 'string', facet: true },
    { name: 'colour', type: 'string', facet: true },
    { name: 'colourHex', type: 'string', index: false, optional: true },
    { name: 'sizes', type: 'string[]', facet: true },
    { name: 'sizesInStock', type: 'string[]', facet: true },
    { name: 'price', type: 'int32', facet: true },
    { name: 'priceMax', type: 'int32' },
    { name: 'image', type: 'object', index: false, optional: true },
    { name: 'isNew', type: 'bool', facet: true },
    { name: 'featured', type: 'bool' },
    { name: 'publishedAt', type: 'int64' },
  ],
} as const;

let client: InstanceType<typeof Typesense.Client> | null = null;

/** Null when search is not configured (local development without Typesense). */
export function searchClient() {
  const host = TYPESENSE_HOST.value();
  const apiKey = TYPESENSE_ADMIN_KEY.value();
  if (!host || !apiKey) return null;
  if (!client) {
    const url = new URL(host.includes('://') ? host : `https://${host}`);
    client = new Typesense.Client({
      nodes: [{ host: url.hostname, port: Number(url.port || (url.protocol === 'http:' ? 80 : 443)), protocol: url.protocol.replace(':', '') }],
      apiKey,
      connectionTimeoutSeconds: 5,
      numRetries: 3,
    });
  }
  return client;
}

export async function ensureCollection() {
  const c = searchClient();
  if (!c) return;
  try {
    await c.collections(PRODUCTS_COLLECTION).retrieve();
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await c.collections().create(productsSchema as any);
  }
}

/** Sizes of a product that have units to sell. */
export async function sizesInStock(product: Product): Promise<string[]> {
  if (!product.variants.length) return [];
  const refs = product.variants.map((v) => db.collection('inventory').doc(v.sku));
  const snaps = await db.getAll(...refs);
  return snaps
    .map((s) => s.data() as InventoryRecord | undefined)
    .filter((inv): inv is InventoryRecord => !!inv && inv.onHand - inv.reserved > 0)
    .map((inv) => inv.size);
}

/** Brings the index in line with Firestore for one product: upsert when live, remove otherwise. */
export async function syncProduct(productId: string) {
  const c = searchClient();
  if (!c) return;
  const snap = await db.collection('products').doc(productId).get();
  const product = snap.data() as Product | undefined;
  try {
    if (!product || product.status !== 'live') {
      await c.collections(PRODUCTS_COLLECTION).documents(productId).delete().catch(() => undefined);
      return;
    }
    await ensureCollection();
    const doc = toSearchDoc(product, await sizesInStock(product), now());
    await c.collections(PRODUCTS_COLLECTION).documents().upsert(doc);
  } catch (err) {
    logger.error('search sync failed', { productId, err: String(err) });
    throw err; // let the trigger retry
  }
}

/** Rebuilds the whole index from Firestore. Safe to run any time. */
export async function reindexAll(): Promise<number> {
  const c = searchClient();
  if (!c) return 0;
  await c.collections(PRODUCTS_COLLECTION).delete().catch(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await c.collections().create(productsSchema as any);
  let count = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection('products').where('status', '==', 'live').orderBy('__name__').limit(200);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    const docs = await Promise.all(page.docs.map(async (d) => {
      const p = d.data() as Product;
      return toSearchDoc(p, await sizesInStock(p), now());
    }));
    await c.collections(PRODUCTS_COLLECTION).documents().import(docs, { action: 'upsert' });
    count += docs.length;
    last = page.docs[page.docs.length - 1];
  }
  return count;
}

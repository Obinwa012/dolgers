import { onDocumentWritten } from 'firebase-functions/firestore';
import { onObjectFinalized } from 'firebase-functions/storage';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import sharp from 'sharp';
import type { InventoryRecord, Product, Vendor } from '@dolgers/shared';
import { db, storage } from './lib/firebase.ts';
import { REGION, REVALIDATE_SECRET, TYPESENSE_ADMIN_KEY } from './lib/params.ts';
import { revalidate } from './lib/revalidate.ts';
import { syncProduct } from './lib/search.ts';

const triggerOpts = { region: REGION, retry: true, maxInstances: 20 } as const;

/** Keeps search and cached pages in step with the product catalog. */
export const onProductWritten = onDocumentWritten(
  { ...triggerOpts, document: 'products/{productId}', secrets: [TYPESENSE_ADMIN_KEY, REVALIDATE_SECRET] },
  async (event) => {
    const before = event.data?.before.data() as Product | undefined;
    const after = event.data?.after.data() as Product | undefined;
    const product = after ?? before;
    if (!product) return;
    await syncProduct(event.params.productId);
    // The website caches pages by slug, so tags use slugs (old and new, if a slug changed).
    const slugs = new Set([before?.slug, after?.slug].filter(Boolean));
    await revalidate([...[...slugs].map((s) => `product:${s}`), `vendor:${product.vendorSlug}`, 'catalog']);
    if (before?.status !== after?.status && (before?.status === 'live' || after?.status === 'live')) {
      const count = await db.collection('products').where('vendorId', '==', product.vendorId).where('status', '==', 'live').count().get();
      await db.collection('vendors').doc(product.vendorId).update({ productCount: count.data().count });
    }
  },
);

/** Re-indexes a product only when a size flips between in stock and sold out. */
export const onInventoryWritten = onDocumentWritten(
  { ...triggerOpts, document: 'inventory/{sku}', secrets: [TYPESENSE_ADMIN_KEY, REVALIDATE_SECRET] },
  async (event) => {
    const before = event.data?.before.data() as InventoryRecord | undefined;
    const after = event.data?.after.data() as InventoryRecord | undefined;
    const avail = (r?: InventoryRecord) => (r ? r.onHand - r.reserved > 0 : false);
    if (avail(before) === avail(after)) return;
    const productId = (after ?? before)!.productId;
    await syncProduct(productId);
    await revalidate(['stock']);
  },
);

/** Copies a vendor's new name onto its products, and refreshes its pages. */
export const onVendorWritten = onDocumentWritten(
  { ...triggerOpts, document: 'vendors/{vendorId}', secrets: [REVALIDATE_SECRET] },
  async (event) => {
    const before = event.data?.before.data() as Vendor | undefined;
    const after = event.data?.after.data() as Vendor | undefined;
    if (!after) return;
    if (before && (before.name !== after.name || before.slug !== after.slug)) {
      let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
      for (;;) {
        let q = db.collection('products').where('vendorId', '==', after.id).orderBy('__name__').limit(400);
        if (last) q = q.startAfter(last);
        const page = await q.get();
        if (page.empty) break;
        const batch = db.batch();
        page.docs.forEach((d) => batch.update(d.ref, { vendorName: after.name, vendorSlug: after.slug }));
        await batch.commit();
        last = page.docs[page.docs.length - 1];
      }
    }
    const slugs = new Set([before?.slug, after.slug].filter(Boolean));
    const listingChanged = !before || before.name !== after.name || before.slug !== after.slug || before.status !== after.status;
    await revalidate([...[...slugs].map((s) => `vendor:${s}`), ...(listingChanged ? ['catalog'] : [])]);
  },
);

/** Follower counts. A very popular store would move this to a sharded counter. */
export const onFollowWritten = onDocumentWritten(
  { ...triggerOpts, document: 'users/{uid}/follows/{vendorId}' },
  async (event) => {
    const created = !event.data?.before.exists && event.data?.after.exists;
    const deleted = event.data?.before.exists && !event.data?.after.exists;
    if (!created && !deleted) return;
    await db.collection('vendors').doc(event.params.vendorId)
      .update({ followerCount: FieldValue.increment(created ? 1 : -1) })
      .catch(() => undefined);
  },
);

export const IMAGE_WIDTHS = [480, 960, 1600] as const;

/**
 * Re-encodes every uploaded image into fixed WebP sizes under /public and deletes the original.
 * Re-encoding strips metadata (including GPS location) and anything hidden in the file.
 */
export const onImageUploaded = onObjectFinalized(
  { region: REGION, memory: '1GiB', maxInstances: 10, cpu: 1 },
  async (event) => {
    const path = event.data.name;
    const match = path.match(/^uploads\/(vendors\/[A-Za-z0-9_-]+|admin)\/([A-Za-z0-9_-]{8,64})\.(jpg|jpeg|png|webp)$/);
    if (!match) return;
    const [, folder, base] = match;
    const bucket = storage();
    const file = bucket.file(path);
    try {
      const [buffer] = await file.download();
      const image = sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
      await Promise.all(IMAGE_WIDTHS.map(async (w) => {
        const out = await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        await bucket.file(`public/${folder}/${base}-${w}.webp`).save(out, {
          contentType: 'image/webp',
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
          resumable: false,
        });
      }));
    } catch (err) {
      logger.warn('rejected upload', { path, err: String(err) });
    } finally {
      await file.delete().catch(() => undefined);
    }
  },
);

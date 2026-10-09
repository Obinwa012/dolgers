import { z } from 'zod';
import type { Review } from '../types.ts';
import type { PhotoCheck } from '../vetting/engine.ts';
import { isRecent } from '../vetting/stats.ts';
import { type AiModels, type ImageInput, loadImage, type StructuredModel } from './claude.ts';

const Schema = z.strictObject({
  photos: z.array(
    z.strictObject({
      photo: z.number(),
      match: z.enum(['matches', 'mismatch', 'unclear']),
      detail: z.string(),
    }),
  ),
  quality: z.string(),
});

const SYSTEM = `You compare a clothing product's listing photos with photos buyers took of what they received.

The first images are the LISTING photos. Then come BUYER photos, each introduced by a line "Buyer photo N".
For each buyer photo decide:
- matches: the same item as listed: same design or print, cut and colour (lighting and phone cameras differ; small shade differences are fine).
- mismatch: clearly a different item: another print or design, a different cut or length, a different fabric, or obviously lower quality than pictured. Describe the difference in one line.
- unclear: the photo doesn't show the item well enough (packaging, far away, cropped).
quality: one or two sentences on what the buyer photos show about fabric and stitching (thin or see-through fabric, loose threads, crooked seams, print quality), or "not visible".
Be strict about evidence: only call a mismatch when the photo clearly shows it.`;

export const MAX_BUYER_PHOTOS = 8;

/** Picks buyer photos to compare: recent and low-star reviews first, one photo per review. */
export function pickBuyerPhotos(reviews: Review[], now: number): { reviewId: string; url: string }[] {
  const withPhotos = reviews.filter((r) => r.imageUrls?.length);
  const score = (r: Review) => (r.stars <= 3 ? 2 : 0) + (isRecent(r.date, now, 90) ? 1 : 0) + (r.country === 'US' ? 0.5 : 0);
  return withPhotos
    .sort((a, b) => score(b) - score(a) || (b.date || '').localeCompare(a.date || ''))
    .slice(0, MAX_BUYER_PHOTOS)
    .map((r) => ({ reviewId: r.id, url: r.imageUrls![0]! }));
}

export async function compareBuyerPhotos(
  model: StructuredModel,
  models: AiModels,
  galleryUrls: string[],
  buyerPhotos: { reviewId: string; url: string }[],
  title: string,
  fetchImpl?: typeof fetch,
): Promise<PhotoCheck> {
  const gallery: ImageInput[] = [];
  for (const url of galleryUrls.slice(0, 4)) {
    const img = await loadImage(url, fetchImpl);
    if (img) gallery.push(img);
  }
  const buyers: { reviewId: string; image: ImageInput }[] = [];
  for (const p of buyerPhotos) {
    const img = await loadImage(p.url, fetchImpl);
    if (img) buyers.push({ reviewId: p.reviewId, image: img });
  }
  if (!gallery.length || !buyers.length) return { picked: buyerPhotos.length, compared: 0, mismatches: [], quality: 'not visible' };
  const out = await model.generate({
    model: models.fast,
    system: SYSTEM,
    parts: [
      { type: 'text', text: `Product: ${title}\nLISTING photos:` },
      ...gallery.map((image) => ({ type: 'image' as const, image })),
      ...buyers.flatMap((b, i) => [{ type: 'text' as const, text: `Buyer photo ${i + 1}` }, { type: 'image' as const, image: b.image }]),
    ],
    schema: Schema,
    maxTokens: 2000,
  });
  const mismatches = out.photos
    .filter((p) => p.match === 'mismatch' && buyers[p.photo - 1])
    .map((p) => ({ reviewId: buyers[p.photo - 1]!.reviewId, detail: p.detail }));
  return { picked: buyerPhotos.length, compared: buyers.length, mismatches, quality: out.quality };
}

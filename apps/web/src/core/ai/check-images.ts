import { z } from 'zod';
import type { ImageCheck } from '../vetting/engine.ts';
import { type AiModels, type ImageInput, loadImage, type StructuredModel } from './claude.ts';

const Schema = z.strictObject({
  ipRisk: z.boolean(),
  findings: z.array(z.string()),
  printDescription: z.string(),
  resemblance: z.strictObject({ brand: z.string(), reason: z.string() }).nullable(),
});

const SYSTEM = `You check product photos for a US clothing store before it sells an item. Flag IP risk when a photo shows any of:
- a recognisable real person's face or likeness printed on the product (celebrity, musician, athlete, influencer), or a real person's name used as the design;
- a brand logo or wordmark that isn't the product's own maker (Nike swoosh, band logos, sports-team marks, luxury monograms);
- a licensed character, cartoon, game, film or TV property;
- text designs that quote a trademarked slogan.
Models wearing the product are fine; only the design matters. Generic graphics, text slogans, florals, animals and plain garments are fine.
findings: one short line per problem ("Photo print of musician 'Mariah the Scientist' on the front"). printDescription: one line describing the design or "plain".

resemblance: separately, say whether the design closely copies a specific known brand's product even without a logo: a signature pattern, print, silhouette, logo placement or colourway (for example a Burberry-style check, Gallery Dept-style paint splatter on flared sweatpants, an Essentials-style chest wordmark, Chrome Hearts-style crosses). Name the brand and give a one-line reason. Use null when it is a generic style anyone sells (plain hoodie, cargo pants, basic graphic tee). This is a flag for a person, so only name a brand when the resemblance is specific.`;

export async function checkImages(
  model: StructuredModel,
  models: AiModels,
  imageUrls: string[],
  title: string,
  fetchImpl?: typeof fetch,
): Promise<ImageCheck & { printDescription: string; checked: number }> {
  const loaded: ImageInput[] = [];
  for (const url of imageUrls.slice(0, 4)) {
    const img = await loadImage(url, fetchImpl);
    if (img) loaded.push(img);
  }
  if (!loaded.length) {
    return { ipRisk: false, findings: ['No product images could be loaded; image check not done'], printDescription: '', resemblance: null, checked: 0 };
  }
  const out = await model.generate({
    model: models.fast,
    system: SYSTEM,
    parts: [{ type: 'text', text: `Listing title: ${title}` }, ...loaded.map((image) => ({ type: 'image' as const, image }))],
    schema: Schema,
    maxTokens: 1500,
  });
  return { ...out, checked: loaded.length };
}

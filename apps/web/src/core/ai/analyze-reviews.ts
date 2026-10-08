import { z } from 'zod';
import type { Review } from '../types.ts';
import type { ReviewAnalysis } from '../vetting/engine.ts';
import { ISSUE_CATEGORIES, ISSUE_RULES, type IssueCategory } from '../vetting/issues.ts';
import type { AiModels, StructuredModel } from './claude.ts';

const IssueSchema = z.strictObject({
  category: z.enum(ISSUE_CATEGORIES as [IssueCategory, ...IssueCategory[]]),
  reviewIds: z.array(z.string()),
  quote: z.string(),
});

const FitSchema = z.strictObject({
  reviewId: z.string(),
  direction: z.enum(['large', 'small', 'true']),
  dimension: z.string(),
  heightIn: z.number().nullable(),
  weightLb: z.number().nullable(),
});

const ChunkSchema = z.strictObject({
  issues: z.array(IssueSchema),
  fit: z.array(FitSchema),
  materialFromReviews: z.string().nullable(),
  summary: z.string(),
});

const SYSTEM = `You read customer reviews of one clothing product sold from a US warehouse and extract evidence. You do not decide whether to sell it.

For each problem a buyer describes, add it under exactly one category, list every review id that describes it, and give one short verbatim quote. Categories:
${Object.entries(ISSUE_RULES).filter(([k]) => k !== 'unexplained_low_rating').map(([k, r]) => `- ${k}: ${r.label}`).join('\n')}

Rules:
- Only cite review ids that appear in the input. Never invent quotes; copy the buyer's words.
- A buyer praising the product is not an issue. "A little big but I love it" is still fit_large.
- "Took 2 weeks" is slow_delivery, not non_delivery. Never received / package lost = non_delivery. Tracking flagged as fraudulent, fake postage, label never scanned = fake_tracking.
- Print or colour coming off, fading, cracking or the garment shrinking after washing or drying = wash_durability. A print that "feels like a sticker" alone is fabric_feel, not wash_durability.
- If buyers state a material that contradicts the listing's stated material, use material_mismatch.
- Real, recognisable brand logos, celebrity photos or licensed characters mentioned by buyers = counterfeit_or_ip.

Fit: for every review that says something about fit, add an entry: direction large/small/true (true = fits as expected), the dimension (overall, waist, length, inseam, chest, sleeves, shoulders, hips), and the buyer's height in inches and weight in pounds if they state them (convert cm/kg; else null).

materialFromReviews: the fabric buyers consistently describe (e.g. "cotton"), or null if they don't say or disagree.
summary: two sentences on what buyers like and dislike.`;

export const ANALYSIS_CHUNK = 120;

/** Reviews with written text, in the fixed order chunks are taken from. */
export function textReviews(reviews: Review[]): Review[] {
  return reviews.filter((r) => r.text || r.additionalText);
}

/** One model call over up to ANALYSIS_CHUNK written reviews. */
export async function analyzeReviewChunk(
  model: StructuredModel,
  models: AiModels,
  chunk: Review[],
  context: { title: string; material: string | null },
): Promise<ReviewAnalysis> {
  const lines = chunk.map((r) =>
    JSON.stringify({
      id: r.id,
      stars: r.stars,
      country: r.country,
      variant: r.skuInfo,
      text: r.text.slice(0, 1200),
      followUp: r.additionalText.slice(0, 600) || undefined,
      tags: Object.keys(r.labels).length ? r.labels : undefined,
    }),
  );
  return model.generate({
    model: models.fast,
    system: SYSTEM,
    parts: [
      {
        type: 'text',
        text: `Product: ${context.title}\nListing says material: ${context.material ?? 'not stated'}\n\nReviews (one JSON object per line):\n${lines.join('\n')}`,
      },
    ],
    schema: ChunkSchema,
    maxTokens: 12000,
  });
}

/** Combines chunk results and adds AliExpress's own fit tags for reviews the model didn't cover. */
export function mergeAnalyses(parts: ReviewAnalysis[], reviews: Review[]): ReviewAnalysis {
  const fromLabels = fitFromLabels(reviews);
  if (!parts.length) return { issues: [], fit: fromLabels, materialFromReviews: null, summary: 'No written reviews.' };
  const issues = new Map<IssueCategory, { reviewIds: Set<string>; quote: string }>();
  for (const r of parts) {
    for (const i of r.issues) {
      const e = issues.get(i.category) ?? { reviewIds: new Set<string>(), quote: i.quote };
      i.reviewIds.forEach((id) => e.reviewIds.add(id));
      issues.set(i.category, e);
    }
  }
  const textFit = parts.flatMap((r) => r.fit);
  const seen = new Set(textFit.map((f) => f.reviewId));
  const materials = parts.map((r) => r.materialFromReviews).filter((m): m is string => !!m);
  return {
    issues: [...issues].map(([category, e]) => ({ category, reviewIds: [...e.reviewIds], quote: e.quote })),
    fit: [...textFit, ...fromLabels.filter((f) => !seen.has(f.reviewId))],
    materialFromReviews: materials.length && materials.every((m) => m.toLowerCase() === materials[0]!.toLowerCase()) ? materials[0]! : null,
    summary: parts.map((r) => r.summary).join(' '),
  };
}

/** All chunks in one go (used by tests and small listings). */
export async function analyzeReviews(
  model: StructuredModel,
  models: AiModels,
  reviews: Review[],
  context: { title: string; material: string | null },
): Promise<ReviewAnalysis> {
  const withText = textReviews(reviews);
  const parts: ReviewAnalysis[] = [];
  for (let i = 0; i < withText.length; i += ANALYSIS_CHUNK) {
    parts.push(await analyzeReviewChunk(model, models, withText.slice(i, i + ANALYSIS_CHUNK), context));
  }
  return mergeAnalyses(parts, reviews);
}

/** AliExpress's own "Fit: Large / Small / Fits ok" tags, counted without the model. */
export function fitFromLabels(reviews: Review[]): ReviewAnalysis['fit'] {
  const out: ReviewAnalysis['fit'] = [];
  for (const r of reviews) {
    const f = (r.labels.Fit ?? '').toLowerCase();
    const direction = f.startsWith('large') ? 'large' : f.startsWith('small') ? 'small' : f.startsWith('fits') ? 'true' : null;
    if (direction) out.push({ reviewId: r.id, direction, dimension: 'overall', heightIn: null, weightLb: null });
  }
  return out;
}

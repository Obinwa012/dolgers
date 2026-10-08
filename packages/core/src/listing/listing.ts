import { z } from 'zod';
import type { AiModels, ImageInput, StructuredModel } from '../ai/claude.ts';
import { loadImage } from '../ai/claude.ts';
import type { UsSizeChart } from '../ai/size-chart.ts';
import type { ProductSnapshot, Sku } from '../types.ts';
import type { VettingConfig } from '../vetting/config.ts';

export const STORE_CATEGORIES = [
  't-shirts', 'polos', 'shirts', 'hoodies-sweatshirts', 'sweaters', 'jackets-coats', 'suits-blazers',
  'pants', 'jeans', 'shorts', 'joggers', 'sets', 'activewear', 'dresses', 'skirts', 'tops-blouses',
  'jumpsuits', 'loungewear', 'other',
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

/** A fact the listing is allowed to state, with where it came from. */
export interface Evidence {
  id: string;
  fact: string;
  source: 'listing' | 'api' | 'reviews' | 'size-chart' | 'photos' | 'policy';
}

const ListingSchema = z.strictObject({
  title: z.string(),
  handle: z.string(),
  storeCategory: z.enum(STORE_CATEGORIES),
  seo: z.strictObject({
    title: z.string(),
    metaDescription: z.string(),
    primaryKeyword: z.string(),
    secondaryKeywords: z.array(z.string()),
  }),
  bullets: z.array(z.string()),
  description: z.array(z.string()),
  faq: z.array(z.strictObject({ q: z.string(), a: z.string() })),
  variants: z.array(z.strictObject({ skuId: z.string(), color: z.string(), size: z.string() })),
  imageAlts: z.array(z.strictObject({ index: z.number(), alt: z.string() })),
  claims: z.array(z.strictObject({ text: z.string(), evidenceIds: z.array(z.string()) })),
});
export type ListingDraft = z.infer<typeof ListingSchema>;

const SYSTEM = `You write the US product page for one item in a clothing store whose rule is: every statement must be true and traceable to the evidence list. Customers are US shoppers; write plain American English.

Hard rules:
- Use only facts in the evidence list. If something isn't there, don't say it. No "premium", "luxury", "high quality", "best", "perfect" or other claims you can't evidence. Never say "Made in USA"; the origin is "Imported".
- Every listing fix in the evidence MUST appear in the bullets or description (e.g. decorative zippers, fit notes).
- Title: what it is, for whom, the pack size and one true feature. Under 70 characters. No years, no "new", no keyword stuffing, no brand names.
- seo.title ≤ 60 characters, primary keyword first. seo.metaDescription ≤ 155 characters with a real reason to click. Keywords must be true of the product.
- handle: lowercase-hyphenated, keywords only, ≤ 60 characters.
- bullets: 4-7 short lines. description: 1-3 short paragraphs. faq: 3-6 questions shoppers actually ask, answered from the evidence (fit, length, material, what's in the pack, delivery time, care).
- variants: one entry per variant id given. Turn codes into real colour names using the variant photos and names (e.g. "LHT13-5P2" → the colours shown, "3PCS" → "3-Pack: Black, Olive, Khaki"). Sizes in US form ("Men L" → "L").
- imageAlts: describe what each numbered product image actually shows.
- claims: list each factual statement you made in bullets/description/faq with the evidence ids that support it.`;

export interface ListingInput {
  product: ProductSnapshot;
  skus: Sku[];
  department: 'men' | 'women';
  material: string | null;
  sizeChart: UsSizeChart | null;
  listingFixes: string[];
  delivery: { minDays: number | null; maxDays: number | null } | null;
  reviewSummary: string;
}

export function buildEvidence(i: ListingInput): Evidence[] {
  const ev: Evidence[] = [];
  const add = (fact: string, source: Evidence['source']) => ev.push({ id: `E${ev.length + 1}`, fact, source });
  add(`Supplier title: ${i.product.title}`, 'listing');
  for (const [k, v] of Object.entries(i.product.attributes)) {
    if (['size_info', 'High-concerned chemical', 'CN', 'Brand Name'].includes(k)) continue;
    add(`${k}: ${v}`, 'listing');
  }
  add(`Department: ${i.department}'s`, 'listing');
  add(i.material ? `Material: ${i.material}` : 'Material: not confirmed (do not state a material)', 'listing');
  add('Origin: Imported (made outside the US); ships from a US warehouse', 'policy');
  if (i.delivery?.maxDays) add(`Delivery: about ${i.delivery.minDays}-${i.delivery.maxDays} days from order to delivery`, 'api');
  add(`Variants sold: ${i.skus.map((s) => Object.entries(s.props).filter(([k]) => k !== 'Ships From').map(([k, v]) => `${k}=${v}`).join(', ')).join(' | ')}`, 'api');
  for (const f of i.listingFixes) add(`Listing fix (must appear): ${f}`, 'reviews');
  if (i.sizeChart) {
    add(`Fit type: ${i.sizeChart.fitType}`, 'size-chart');
    for (const n of i.sizeChart.fitNotes) add(`Fit note: ${n}`, 'size-chart');
    for (const r of i.sizeChart.rows) {
      add(`Size ${r.size}: fits ${r.fitsBody.map((b) => `${b.measure} ${b.min}-${b.max}"`).join(', ')}; garment ${Object.entries(r.garment).map(([k, v]) => `${k} ${v}"`).join(', ')}`, 'size-chart');
    }
  }
  if (i.reviewSummary) add(`What buyers say: ${i.reviewSummary}`, 'reviews');
  return ev;
}

export interface ListingResult {
  draft: ListingDraft;
  evidence: Evidence[];
  problems: string[];
}

export async function writeListing(
  model: StructuredModel,
  models: AiModels,
  input: ListingInput,
  config: VettingConfig,
  fetchImpl?: typeof fetch,
): Promise<ListingResult> {
  const evidence = buildEvidence(input);
  const imgs: ImageInput[] = [];
  for (const url of input.product.images.slice(0, 5)) {
    const im = await loadImage(url, fetchImpl);
    if (im) imgs.push(im);
  }
  const skuImgs: { skuId: string; img: ImageInput }[] = [];
  for (const s of uniqueBy(input.skus.filter((s) => s.image), (s) => s.image!).slice(0, 6)) {
    const im = await loadImage(s.image!, fetchImpl);
    if (im) skuImgs.push({ skuId: s.skuId, img: im });
  }
  const draft = await model.generate({
    model: models.careful,
    system: SYSTEM,
    parts: [
      { type: 'text', text: `Evidence:\n${evidence.map((e) => `${e.id} [${e.source}] ${e.fact}`).join('\n')}` },
      { type: 'text', text: `Variant ids to name:\n${input.skus.map((s) => `${s.skuId}: ${JSON.stringify(s.props)}`).join('\n')}` },
      { type: 'text', text: `Product images ${imgs.length ? `0-${imgs.length - 1}` : '(none)'} follow.` },
      ...imgs.map((image) => ({ type: 'image' as const, image })),
      ...skuImgs.flatMap((s) => [
        { type: 'text' as const, text: `Variant photo for ${s.skuId}:` },
        { type: 'image' as const, image: s.img },
      ]),
    ],
    schema: ListingSchema,
    maxTokens: 8000,
  });
  return { draft, evidence, problems: validateListing(draft, input, evidence, config) };
}

const PUFFERY = /\b(premium|luxury|luxurious|high[- ]quality|best|perfect|flawless|never fades?|guaranteed|world[- ]class|top[- ]quality|superior|ultimate|finest)\b/i;
/** Performance claims: allowed only when the evidence itself says so. */
const PERFORMANCE = ['breathable', 'durable', 'moisture-wicking', 'moisture wicking', 'wrinkle-free', 'wrinkle free', 'quick-dry', 'quick dry', 'quick-drying', 'waterproof', 'water-resistant', 'stain-resistant', 'anti-odor', 'odor-resistant', 'uv protection', 'upf', 'thermal', 'warm', 'stretch', 'non-shrink', 'shrink-resistant', 'fade-resistant', 'anti-pilling', 'hypoallergenic', 'organic', 'sustainable', 'eco-friendly'];
const MADE_IN_USA = /\b(made|manufactured|produced|sewn|crafted)\s+in\s+(the\s+)?(usa|u\.?\s?s\.?(\s?a\.?)?|america|united states)\b|\b(usa|u\.s\.|us|american)[- ]made\b/i;
const MATERIALS = [
  'cotton', 'polyester', 'linen', 'wool', 'silk', 'nylon', 'spandex', 'elastane', 'lycra', 'rayon', 'viscose',
  'modal', 'lyocell', 'tencel', 'acrylic', 'fleece', 'satin', 'chiffon', 'velvet', 'corduroy', 'denim', 'leather',
  'suede', 'cashmere', 'bamboo', 'hemp', 'mesh', 'jersey', 'twill', 'canvas', 'polyamide',
];
/** Fabric words that describe a weave or finish of the confirmed fibre rather than a different fibre. */
const MATERIAL_COMPAT: Record<string, string[]> = {
  denim: ['cotton'], twill: ['cotton', 'polyester'], canvas: ['cotton'], jersey: ['cotton', 'polyester', 'rayon', 'modal'],
  fleece: ['polyester', 'cotton'], satin: ['polyester', 'silk'], chiffon: ['polyester', 'silk'], mesh: ['polyester', 'nylon'],
  velvet: ['polyester', 'cotton'], corduroy: ['cotton'], lycra: ['spandex', 'elastane'], elastane: ['spandex'], spandex: ['elastane'],
  tencel: ['lyocell'], polyamide: ['nylon'], nylon: ['polyamide'],
};

/** Checks the model can't be trusted to do on its own. Any problem holds the product for review. */
export function validateListing(d: ListingDraft, input: ListingInput, evidence: Evidence[], config: VettingConfig): string[] {
  const problems: string[] = [];
  const customerText = [
    d.title, d.handle.replace(/-/g, ' '), d.seo.title, d.seo.metaDescription, d.seo.primaryKeyword, ...d.seo.secondaryKeywords,
    ...d.bullets, ...d.description, ...d.faq.flatMap((f) => [f.q, f.a]),
    ...d.variants.flatMap((v) => [v.color, v.size]), ...d.imageAlts.map((a) => a.alt),
  ].join('\n');
  const evidenceText = evidence.map((e) => e.fact).join('\n').toLowerCase();
  if (d.title.length > 80) problems.push(`Title is ${d.title.length} characters (max 80)`);
  if (d.seo.title.length > 60) problems.push(`SEO title is ${d.seo.title.length} characters (max 60)`);
  if (d.seo.metaDescription.length > 160) problems.push(`Meta description is ${d.seo.metaDescription.length} characters (max 160)`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.handle) || d.handle.length > 60) problems.push(`Handle "${d.handle}" is not a short lowercase-hyphenated slug`);
  if (MADE_IN_USA.test(customerText)) problems.push('Claims US manufacture ("Made in USA" or similar)');
  const puff = PUFFERY.exec(customerText);
  if (puff) problems.push(`Unsupported claim word: "${puff[0]}"`);
  for (const w of PERFORMANCE) {
    if (new RegExp(`\\b${esc(w)}\\b`, 'i').test(customerText) && !evidenceText.includes(w.replace('-', ' ')) && !evidenceText.includes(w)) {
      problems.push(`Performance claim "${w}" isn't in the evidence`);
    }
  }
  const brand = config.ipBlocklist.find((w) => new RegExp(`\\b${esc(w)}\\b`, 'i').test(customerText));
  if (brand) problems.push(`Mentions a protected name: "${brand}"`);
  const mat = (input.material ?? '').toLowerCase();
  for (const m of MATERIALS) {
    if (!new RegExp(`\\b${m}\\b`, 'i').test(customerText)) continue;
    const ok = mat.includes(m) || (MATERIAL_COMPAT[m] ?? []).some((x) => mat.includes(x));
    if (!ok) problems.push(`Mentions ${m} but the confirmed material is "${input.material ?? 'unknown'}"`);
  }
  const ids = new Set(evidence.map((e) => e.id));
  for (const c of d.claims) {
    const bad = c.evidenceIds.filter((id) => !ids.has(id));
    if (!c.evidenceIds.length || bad.length) problems.push(`Claim without valid evidence: "${c.text.slice(0, 80)}"`);
  }
  const named = new Set(d.variants.map((v) => v.skuId));
  const missing = input.skus.filter((s) => !named.has(s.skuId));
  if (missing.length) problems.push(`${missing.length} variant(s) have no US name`);
  if (d.variants.some((v) => /^[A-Z0-9]{3,}-\w+$/i.test(v.color) || /^\d+\s*PCS$/i.test(v.color) || !v.color.trim())) {
    problems.push('A variant colour is still a supplier code or blank');
  }
  const pageText = [...d.bullets, ...d.description, ...d.faq.flatMap((f) => [f.q, f.a])].join('\n');
  for (const fix of input.listingFixes) {
    const key = fixPattern(fix);
    if (!key) problems.push(`Listing fix needs a manual check: ${fix}`);
    else if (!key.test(pageText)) problems.push(`Listing fix not applied: ${fix}`);
  }
  if (!input.material) problems.push('Material is not confirmed (required for clothing listings)');
  return problems;
}

/** What the page must say for each listing fix to count as applied. */
function fixPattern(fix: string): RegExp | null {
  if (/decorative|disclose/i.test(fix)) return /decorative|non-functional|not functional|don'?t (open|work)/i;
  if (/size down/i.test(fix)) return /size down|runs (slightly |a bit )?(large|big)|roomy/i;
  if (/size up/i.test(fix)) return /size up|runs (slightly |a bit )?small/i;
  if (/lightweight/i.test(fix)) return /lightweight|light-weight|thin/i;
  if (/inseam|length/i.test(fix)) return /\b(inseam|length)\b[^.\n]*\d/i;
  if (/sleeve/i.test(fix)) return /sleeve[^.\n]*\d/i;
  if (/colou?r/i.test(fix)) return /colou?rs? (may|can|might|are|is|look|appear)[^.\n]*(bright|dark|differ|vary|vivid|than)|(brighter|darker|more vivid) than/i;
  if (/delivery/i.test(fix)) return /\b\d+\s*[-–to]+\s*\d+\s*(business )?days\b/i;
  if (/pack/i.test(fix)) return /\b(pack|set) (of|includes|contains)|\d+[- ]pack\b[^.\n]*:/i;
  if (/wash|steam/i.test(fix)) return /\b(wash|steam)/i;
  if (/fabric/i.test(fix)) return /\b(fabric|feel|texture|material)\b/i;
  return null;
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueBy<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

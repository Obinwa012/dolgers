import type { FreightQuote, ProductSnapshot, Review, ReviewSet, ShippingOption } from '../types.ts';
import { groupBuyers, isChinaLogistics, isPooled } from '../reviews/reviews.ts';
import type { VettingConfig } from './config.ts';
import { type Bucket, type IssueCategory, ISSUE_RULES, ruleFor } from './issues.ts';

export type CheckLevel = 'reject' | 'review' | 'insufficient' | 'info';

export interface Check {
  id: string;
  pass: boolean;
  /** What a failure means. */
  level: CheckLevel;
  detail: string;
}

/** What the AI review analysis returns (validated before it gets here). */
export interface ReviewAnalysis {
  issues: { category: IssueCategory; reviewIds: string[]; quote: string }[];
  fit: {
    reviewId: string;
    direction: 'large' | 'small' | 'true';
    dimension: string;
    heightIn: number | null;
    weightLb: number | null;
  }[];
  /** Material stated by buyers, if consistent ("100% cotton"). */
  materialFromReviews: string | null;
  summary: string;
}

export interface ImageCheck {
  ipRisk: boolean;
  findings: string[];
}

export interface SellerRecord {
  storeId: string;
  name: string;
  blocked: boolean;
  blockReasons: string[];
  /** Fingerprints of blocked sellers we resemble (possible sibling stores). */
  linkedTo: string[];
}

export type Decision = 'import' | 'probation' | 'needs_review' | 'insufficient_data' | 'reject';

export interface AggregatedIssue {
  category: IssueCategory;
  label: string;
  bucket: Bucket;
  buyers: number;
  /** The model's quote was found in a cited review. */
  verified: boolean;
  reviewIds: string[];
  quotes: string[];
  fix: string | null;
}

export interface ScreenResult {
  pass: boolean;
  checks: Check[];
  usSkuIds: string[];
  shipping: (ShippingOption & { skuId: string }) | null;
  suspiciousShipping: boolean;
}

export interface VetResult extends Omit<ScreenResult, 'pass'> {
  decision: Decision;
  reasons: string[];
  metrics: {
    ratings: number;
    writtenReviews: number;
    buyers: number;
    textBuyers: number;
    usBuyers: number;
    lowStarBuyers: number;
    problemBuyers: number;
    problemRate: number;
    /** With zero problems in n buyers, the true rate could still be up to ~3/n (95%). Null when problems were seen. */
    problemRateUpperBound: number | null;
    usVariantShare: number;
    chinaLogisticsShare: number;
  };
  issues: AggregatedIssue[];
  listingFixes: string[];
  /** Seller-level problems confirmed on this product; the writer records them on the seller. */
  sellerStrikes: IssueCategory[];
}

const PRIORITY = /priority/i;

function check(id: string, pass: boolean, level: CheckLevel, detail: string): Check {
  return { id, pass, level, detail };
}

/** The cheap stage: one product.get plus a freight quote. Runs before any reviews are fetched. */
export function screen(product: ProductSnapshot, freight: FreightQuote[], config: VettingConfig): ScreenResult {
  const checks: Check[] = [];
  checks.push(check('listing_active', product.status === 'onSelling', 'reject', `Status: ${product.status || 'unknown'}`));

  const usSkus = product.skus.filter((s) => s.shipsFrom === 'United States' && (s.stock ?? 0) > 0);
  checks.push(
    check('ships_from_us', usSkus.length > 0, 'reject', `${usSkus.length} of ${product.skus.length} variants ship from the US with stock`),
  );
  if (usSkus.length && usSkus.length < product.skus.length) {
    checks.push(check('mixed_origin', true, 'info', 'Some variants ship from elsewhere; only US variants will be sold'));
  }

  const r = product.store.ratings;
  const ratings = [r.asDescribed, r.communication, r.shipping];
  const ratingsOk = ratings.every((x) => x !== null && x >= config.minStoreRating);
  checks.push(
    check(
      'store_ratings',
      ratingsOk,
      'reject',
      `As described ${r.asDescribed ?? '–'}, communication ${r.communication ?? '–'}, shipping ${r.shipping ?? '–'} (need ${config.minStoreRating}+ each)`,
    ),
  );

  const haystack = `${product.title} ${product.attributes['Brand Name'] ?? ''}`.toLowerCase();
  const ipHits = config.ipBlocklist.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(haystack));
  checks.push(check('ip_title', ipHits.length === 0, 'reject', ipHits.length ? `Mentions ${ipHits.join(', ')}` : 'No brand/likeness terms'));

  const usSkuIds = new Set(usSkus.map((s) => s.skuId));
  let best: (ShippingOption & { skuId: string }) | null = null;
  for (const q of freight) {
    if (!usSkuIds.has(q.skuId)) continue;
    for (const o of q.options) {
      if (o.shipFrom !== 'US') continue;
      if (!best || o.feeCents < best.feeCents || (o.feeCents === best.feeCents && (o.maxDays ?? 99) < (best.maxDays ?? 99))) {
        best = { ...o, skuId: q.skuId };
      }
    }
  }
  checks.push(
    check('us_shipping_quote', !!best, 'reject', best ? `${best.carrier} from the US, ${best.minDays}-${best.maxDays} days` : 'No US shipping quote'),
  );
  if (best) {
    checks.push(
      check('delivery_window', (best.maxDays ?? 99) <= config.maxDeliveryDays, 'review', `Up to ${best.maxDays} days (limit ${config.maxDeliveryDays})`),
    );
  }

  const cheapest = Math.min(...usSkus.map((s) => s.priceCents ?? Infinity));
  const suspiciousShipping =
    !!best &&
    PRIORITY.test(best.carrier) &&
    best.feeCents <= config.suspiciousShippingMaxFeeCents &&
    cheapest <= config.suspiciousShippingMaxItemCents;
  if (suspiciousShipping) {
    checks.push(
      check('shipping_plausible', false, 'review', `${best!.carrier} for $${(best!.feeCents / 100).toFixed(2)} on a $${(cheapest / 100).toFixed(2)} item is below that carrier's normal cost`),
    );
  }

  checks.push(
    check('review_count', product.reviewCount >= config.probationMinBuyers, 'insufficient', `${product.reviewCount} reviews (need ${config.probationMinBuyers}+ to vet)`),
  );

  const pass = checks.every((c) => c.pass || c.level === 'info' || c.level === 'review');
  return { pass, checks, usSkuIds: [...usSkuIds], shipping: best, suspiciousShipping };
}

export interface VetInput {
  product: ProductSnapshot;
  freight: FreightQuote[];
  reviews: ReviewSet | null;
  analysis: ReviewAnalysis | null;
  imageCheck: ImageCheck | null;
  seller: SellerRecord | null;
  config: VettingConfig;
}

export function vet(input: VetInput): VetResult {
  const { product, reviews, analysis, config } = input;
  const s = screen(product, input.freight, config);
  const checks = [...s.checks];
  const reasons: string[] = [];

  const empty = {
    ratings: product.reviewCount, writtenReviews: 0, buyers: 0, textBuyers: 0, usBuyers: 0, lowStarBuyers: 0,
    problemBuyers: 0, problemRate: 0, problemRateUpperBound: null, usVariantShare: 0, chinaLogisticsShare: 0,
  };
  const base = { checks, usSkuIds: s.usSkuIds, shipping: s.shipping, suspiciousShipping: s.suspiciousShipping };
  const finish = (decision: Decision, extra: Partial<VetResult> = {}): VetResult => ({
    ...base, decision, reasons, metrics: empty, issues: [], listingFixes: [], sellerStrikes: [], ...extra,
  });

  // 1. Hard eligibility failures.
  const rejects = checks.filter((c) => !c.pass && c.level === 'reject');
  if (rejects.length) {
    reasons.push(...rejects.map((c) => c.detail));
    return finish('reject');
  }
  if (input.seller?.blocked) {
    reasons.push(`Seller blocked: ${input.seller.blockReasons.join('; ')}`);
    return finish('reject');
  }
  if (input.imageCheck?.ipRisk) {
    checks.push(check('ip_image', false, 'reject', input.imageCheck.findings.join('; ')));
    reasons.push(`Image shows protected brand or likeness: ${input.imageCheck.findings.join('; ')}`);
    return finish('reject');
  }
  if (!s.pass) {
    reasons.push(...checks.filter((c) => !c.pass && c.level === 'insufficient').map((c) => c.detail));
    return finish('insufficient_data');
  }

  // 2. Trust: are these this seller's own, US-shipped reviews?
  if (!reviews) {
    reasons.push('Reviews could not be fetched');
    return finish('insufficient_data');
  }
  const trust = trustCheck(reviews, config);
  checks.push(...trust.checks);
  const all = reviews.reviews;
  const { usVariantShare, chinaShare } = trust;
  const trustFails = trust.checks.filter((c) => !c.pass);
  if (trustFails.length) {
    reasons.push(...trustFails.map((c) => c.detail));
    return finish('insufficient_data');
  }

  // 3. Buyers and problems.
  const buyers = groupBuyers(all);
  const byReview = new Map<string, number>();
  buyers.forEach((g, i) => g.forEach((r) => byReview.set(r.id, i)));
  const textBuyers = buyers.filter((g) => g.some((r) => r.text || r.additionalText)).length;
  const usBuyers = buyers.filter((g) => g[0]!.country === 'US').length;
  const lowStar = new Set(buyers.flatMap((g, i) => (g.some((r) => r.stars <= 3) ? [i] : [])));

  type Entry = { buyers: Set<number>; reviewIds: Set<string>; quotes: string[]; verified: boolean };
  const issueMap = new Map<IssueCategory, Entry>();
  const reviewById = new Map(all.map((r) => [r.id, r]));
  for (const iss of analysis?.issues ?? []) {
    if (!(iss.category in ISSUE_RULES)) continue;
    const e = issueMap.get(iss.category) ?? { buyers: new Set<number>(), reviewIds: new Set<string>(), quotes: [], verified: false };
    const cited = iss.reviewIds.filter((id) => byReview.has(id)); // drop ids the model invented
    for (const id of cited) {
      e.buyers.add(byReview.get(id)!);
      e.reviewIds.add(id);
    }
    // The quote must really appear in one of the cited reviews; an unverified issue can't
    // reject on a single report or strike the seller.
    if (cited.some((id) => quoteIn(iss.quote, reviewById.get(id)!))) e.verified = true;
    if (iss.quote && e.quotes.length < 5) e.quotes.push(iss.quote);
    if (e.buyers.size) issueMap.set(iss.category, e);
  }

  // Sizing that goes both ways on the same measurement is a factory-consistency problem,
  // not something a size chart fixes. A buyer who says both (waist loose, inseam short) is
  // compared per measurement, never against themselves.
  const fit = analysis?.fit ?? [];
  const byDim = new Map<string, { large: Set<number>; small: Set<number>; ids: Set<string> }>();
  for (const f of fit) {
    const b = byReview.get(f.reviewId);
    if (b === undefined || f.direction === 'true') continue;
    const dim = normDimension(f.dimension);
    const d = byDim.get(dim) ?? { large: new Set<number>(), small: new Set<number>(), ids: new Set<string>() };
    d[f.direction].add(b);
    d.ids.add(f.reviewId);
    byDim.set(dim, d);
  }
  for (const [dim, d] of byDim) {
    const both = [...d.large].filter((b) => d.small.has(b));
    both.forEach((b) => (d.large.delete(b), d.small.delete(b)));
    const minority = Math.min(d.large.size, d.small.size);
    if (minority >= 2 && minority / (d.large.size + d.small.size) >= 0.3) {
      const e = issueMap.get('fit_inconsistent') ?? { buyers: new Set<number>(), reviewIds: new Set<string>(), quotes: [], verified: true };
      [...d.large, ...d.small].forEach((b) => e.buyers.add(b));
      d.ids.forEach((id) => e.reviewIds.add(id));
      e.quotes.push(`${dim}: ${d.large.size} buyers say it runs large, ${d.small.size} say small`);
      issueMap.set('fit_inconsistent', e);
    }
  }

  // A low rating only counts as explained by a defect (B or C). "Runs small" alongside a
  // 1-star review doesn't prove the 1 star was only about size.
  const explained = new Set(
    [...issueMap].filter(([c]) => ruleFor(c).bucket !== 'A').flatMap(([, e]) => [...e.buyers]),
  );
  const unexplained = [...lowStar].filter((b) => !explained.has(b));
  if (unexplained.length) {
    issueMap.set('unexplained_low_rating', {
      buyers: new Set(unexplained),
      reviewIds: new Set(unexplained.flatMap((b) => buyers[b]!.map((r) => r.id))),
      quotes: [],
      verified: true,
    });
  }

  const issues: AggregatedIssue[] = [];
  const sellerStrikes: IssueCategory[] = [];
  const bBuyers = new Set<number>();
  const systemicReject: string[] = [];
  const systemicReview: string[] = [];
  for (const [category, e] of issueMap) {
    const rule = ruleFor(category);
    let bucket = rule.bucket;
    if (bucket === 'B' && rule.escalateToCAt && e.buyers.size >= rule.escalateToCAt) bucket = 'C';
    issues.push({
      category, label: rule.label, bucket, buyers: e.buyers.size, verified: e.verified,
      reviewIds: [...e.reviewIds], quotes: e.quotes, fix: bucket === 'A' ? rule.fix ?? null : null,
    });
    if (bucket === 'B') e.buyers.forEach((b) => bBuyers.add(b));
    if (bucket === 'C') {
      const rejectAt = rule.rejectAt ?? rule.escalateToCAt ?? config.systemicRejectBuyers;
      const strict = rejectAt === 1 || rule.sellerLevel;
      if (e.buyers.size >= rejectAt && (e.verified || !strict)) {
        systemicReject.push(`${rule.label} (${e.buyers.size} buyer${e.buyers.size === 1 ? '' : 's'})`);
        if (rule.sellerLevel) sellerStrikes.push(category);
      } else {
        systemicReview.push(`${rule.label} (${e.buyers.size} buyer${e.buyers.size === 1 ? '' : 's'}${e.verified ? '' : ', quote not found in the review'})`);
        // Still a problem the customer would have: count it against the rate.
        e.buyers.forEach((b) => bBuyers.add(b));
      }
    }
  }
  issues.sort((a, b) => b.bucket.localeCompare(a.bucket) || b.buyers - a.buyers);

  const n = buyers.length;
  const problemRate = n ? bBuyers.size / n : 0;
  const metrics = {
    ratings: reviews.stats.total || product.reviewCount,
    writtenReviews: all.length,
    buyers: n,
    textBuyers,
    usBuyers,
    lowStarBuyers: lowStar.size,
    problemBuyers: bBuyers.size,
    problemRate,
    problemRateUpperBound: n && bBuyers.size === 0 ? Math.min(1, 3 / n) : null,
    usVariantShare,
    chinaLogisticsShare: chinaShare,
  };
  const listingFixes = [...new Set(issues.filter((i) => i.bucket === 'A' && i.fix).map((i) => i.fix!))];
  const out = (d: Decision) => finish(d, { metrics, issues, listingFixes, sellerStrikes });

  if (systemicReject.length) {
    reasons.push(`Systemic problems: ${systemicReject.join('; ')}`);
    return out('reject');
  }
  if (n < config.probationMinBuyers) {
    reasons.push(`${n} unique buyers (need ${config.probationMinBuyers}+)`);
    return out('insufficient_data');
  }
  if (problemRate > config.maxProblemRate) {
    reasons.push(`${bBuyers.size} of ${n} buyers had problems customer service would have to absorb (${pct(problemRate)}, cap ${pct(config.maxProblemRate)})`);
    return out('reject');
  }

  // 4. Tier.
  const ratings = product.store.ratings;
  const strongSeller = [ratings.asDescribed, ratings.communication, ratings.shipping].every(
    (x) => x !== null && x >= config.strongSellerRating,
  );
  let decision: Decision;
  if (n >= config.importMinBuyers && textBuyers >= config.importMinTextReviews) {
    decision = 'import';
    reasons.push(`${n} buyers, ${pct(problemRate)} with absorbable problems`);
  } else if (strongSeller) {
    decision = 'probation';
    reasons.push(`${n} buyers (${textBuyers} with text): enough for probation with a strong seller, not a plain import`);
  } else {
    reasons.push(`${n} buyers and the seller's ratings aren't strong enough (${config.strongSellerRating}+) to back probation`);
    return out('insufficient_data');
  }

  // 5. Anything a person should look at first.
  const review: string[] = [...systemicReview];
  if (s.suspiciousShipping) review.push('Shipping price is implausibly low for the carrier (possible label fraud)');
  for (const c of checks) if (!c.pass && c.level === 'review') review.push(c.detail);
  if (input.seller?.linkedTo.length) review.push(`Store resembles blocked seller(s): ${input.seller.linkedTo.join(', ')}`);
  if (!input.imageCheck) review.push('Images were not checked for brands or likenesses');
  if (review.length) {
    reasons.push(...review.map((r) => `Needs review: ${r}`));
    return out(decision === 'import' ? 'needs_review' : 'probation');
  }
  return out(decision);
}

/** Are these the seller's own reviews, for US-warehouse variants, shipped by US carriers? */
export function trustCheck(reviews: ReviewSet, config: VettingConfig) {
  const pooled = isPooled(reviews);
  const all = reviews.reviews;
  const usVariantShare = all.length ? all.filter((r) => r.shipsFromUS).length / all.length : 0;
  const chinaShare = all.length ? all.filter((r) => isChinaLogistics(r.logistics)).length / all.length : 0;
  const checks = [
    check('own_reviews', !pooled, 'insufficient', pooled ? 'Reviews are pooled across sellers; this seller cannot be judged from them' : "Reviews are this listing's own"),
    check('reviews_complete', reviews.complete, 'insufficient', reviews.complete ? 'All review pages fetched' : 'Some review pages could not be fetched'),
    check('reviews_us_variant', usVariantShare >= config.minUsVariantShare, 'insufficient', `${pct(usVariantShare)} of reviews are for US-warehouse variants`),
    check('reviews_us_carrier', chinaShare <= config.maxChinaLogisticsShare, 'insufficient', `${pct(chinaShare)} of reviewed orders shipped from China`),
  ];
  return { pass: checks.every((c) => c.pass), checks, usVariantShare, chinaShare };
}

export function fitEvidenceFor(reviews: Review[], analysis: ReviewAnalysis | null, country = 'US') {
  const byId = new Map(reviews.map((r) => [r.id, r]));
  return (analysis?.fit ?? [])
    .map((f) => ({ ...f, review: byId.get(f.reviewId) }))
    .filter((f) => f.review && f.review.country === country)
    .map((f) => ({
      size: sizeFromSku(f.review!.skuInfo),
      direction: f.direction,
      dimension: f.dimension,
      heightIn: f.heightIn,
      weightLb: f.weightLb,
      quote: f.review!.text.slice(0, 200),
    }));
}

const SKU_KEYS = ['Ships From', 'Sale by Pack', 'Color', 'Colour', 'Size', 'Material', 'Style', 'Length', 'Quantity', 'Specification', 'Pattern'];

/** "Color:black Size:XL 85-100KG Ships From:United States" → { Color: 'black', Size: 'XL 85-100KG', … } */
export function parseSkuInfo(skuInfo: string): Record<string, string> {
  const re = new RegExp(`(${SKU_KEYS.map(escapeRe).join('|')})\\s*:`, 'g');
  const marks = [...skuInfo.matchAll(re)];
  const out: Record<string, string> = {};
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : skuInfo.length;
    out[m[1]!] = skuInfo.slice(start, end).trim();
  });
  return out;
}

export function sizeFromSku(skuInfo: string): string | null {
  return parseSkuInfo(skuInfo).Size ?? null;
}

function normText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** True when the model's quote (or its first 40 characters) appears in the review. */
export function quoteIn(quote: string, r: Review): boolean {
  const q = normText(quote);
  if (q.length < 3) return false;
  const text = normText(`${r.text} ${r.additionalText}`);
  return text.includes(q) || text.includes(q.slice(0, 40));
}

function normDimension(d: string): string {
  const x = d.toLowerCase();
  if (/waist/.test(x)) return 'waist';
  if (/inseam|leg/.test(x)) return 'inseam';
  if (/length|long|short/.test(x)) return 'length';
  if (/chest|bust/.test(x)) return 'chest';
  if (/sleeve|arm/.test(x)) return 'sleeves';
  if (/shoulder/.test(x)) return 'shoulders';
  if (/hip|seat/.test(x)) return 'hips';
  return 'overall';
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

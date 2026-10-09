import type { FreightQuote, ProductSnapshot, Review, ReviewSet, ShippingOption } from '../types.ts';
import { groupBuyers, isChinaLogistics, isPooled } from '../reviews/reviews.ts';
import { NON_BRAND_TERMS, type VettingConfig } from './config.ts';
import { type Bucket, type IssueCategory, ISSUE_RULES, ruleFor } from './issues.ts';
import { fakeReviewSignals, isRecent, wilsonUpper } from './stats.ts';

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
  /** The design looks like a known brand's product: a flag for a person, not a rejection. */
  resemblance?: { brand: string; reason: string } | null;
}

/** Gallery photos compared with buyers' own photos of what arrived. */
export interface PhotoCheck {
  /** Buyer photos chosen for comparison; `compared` is how many actually loaded. */
  picked?: number;
  compared: number;
  mismatches: { reviewId: string; detail: string }[];
  /** What buyer photos show about fabric and stitching. */
  quality: string;
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
    /** One-sided 95% Wilson upper bound on the problem rate. */
    problemRateUpperBound: number | null;
    usVariantShare: number;
    chinaLogisticsShare: number;
    /** Written reviews from the last `recentDays` days. */
    recentReviews?: number;
    recentBuyers?: number;
    recentProblemRate?: number | null;
  };
  /** Things a person should look at before publishing, with reasons. */
  flags?: string[];
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

  const ipHits = blockedTerms(`${product.title} ${product.attributes['Brand Name'] ?? ''}`, config.ipBlocklist);
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
  photoCheck?: PhotoCheck | null;
  seller: SellerRecord | null;
  config: VettingConfig;
  now?: number;
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
  const now = input.now ?? Date.now();
  const trust = trustCheck(reviews, config, now);
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
  const recentBuyer = new Set(buyers.flatMap((g, i) => (g.some((r) => isRecent(r.date, now, config.recentDays)) ? [i] : [])));
  type Entry = { buyers: Set<number>; reviewIds: Set<string>; quotes: string[]; verified: boolean };
  const issueMap = new Map<IssueCategory, Entry>();
  const reviewById = new Map(all.map((r) => [r.id, r]));
  const flags: string[] = [];
  for (const iss of analysis?.issues ?? []) {
    if (!(iss.category in ISSUE_RULES)) continue;
    const e = issueMap.get(iss.category) ?? { buyers: new Set<number>(), reviewIds: new Set<string>(), quotes: [], verified: false };
    const cited = iss.reviewIds.filter((id) => byReview.has(id)); // drop ids the model invented
    for (const id of cited) {
      e.buyers.add(byReview.get(id)!);
      e.reviewIds.add(id);
    }
    // The quote must really appear in one of the cited reviews; if it doesn't, the issue still
    // counts toward the rates but can't reject on a single report, and the product is flagged.
    if (cited.some((id) => quoteIn(iss.quote, reviewById.get(id)!))) e.verified = true;
    if (iss.quote && e.quotes.length < 5) e.quotes.push(iss.quote);
    if (e.buyers.size) issueMap.set(iss.category, e);
  }
  // Buyers whose own photos show something different from the gallery.
  for (const m of input.photoCheck?.mismatches ?? []) {
    const b = byReview.get(m.reviewId);
    if (b === undefined) continue;
    const e = issueMap.get('not_as_pictured') ?? { buyers: new Set<number>(), reviewIds: new Set<string>(), quotes: [], verified: true };
    e.buyers.add(b);
    e.reviewIds.add(m.reviewId);
    if (e.quotes.length < 5) e.quotes.push(`Buyer photo: ${m.detail}`);
    issueMap.set('not_as_pictured', e);
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
  const n = buyers.length;
  const issues: AggregatedIssue[] = [];
  const sellerStrikes: IssueCategory[] = [];
  const problemBuyers = new Set<number>();
  const systemicReject: string[] = [];
  for (const [category, e] of issueMap) {
    const rule = ruleFor(category);
    let bucket = rule.bucket;
    if (bucket === 'B' && rule.escalateToCAt && e.buyers.size >= rule.escalateToCAt) bucket = 'C';
    issues.push({
      category, label: rule.label, bucket, buyers: e.buyers.size, verified: e.verified,
      reviewIds: [...e.reviewIds], quotes: e.quotes, fix: bucket === 'A' ? rule.fix ?? null : null,
    });
    if (!e.verified) flags.push(`${rule.label}: the quoted complaint wasn't found in the cited review`);
    if (bucket === 'B') e.buyers.forEach((b) => problemBuyers.add(b));
    if (bucket === 'C') {
      const rejectAt = rule.rejectAt ?? rule.escalateToCAt ?? config.systemicRejectBuyers;
      // Fake tracking, IP and safety reject on one verified report; everything else needs
      // `rejectAt` buyers and more than `systemicRejectShare` of all buyers.
      const enough = rejectAt === 1 ? e.buyers.size >= 1 : e.buyers.size >= rejectAt && e.buyers.size / Math.max(1, n) > config.systemicRejectShare;
      // A quote the code couldn't find in the review flags the product; it can't reject on its own.
      if (enough && e.verified) {
        systemicReject.push(`${rule.label} (${e.buyers.size} of ${n} buyers)`);
        if (rule.sellerLevel) sellerStrikes.push(category);
      } else {
        flags.push(`${rule.label} (${e.buyers.size} buyer${e.buyers.size === 1 ? '' : 's'}): one report of a problem that can't be fixed`);
        // A customer would still have had this problem: count it against the rate.
        e.buyers.forEach((b) => problemBuyers.add(b));
      }
    }
  }
  issues.sort((a, b) => b.bucket.localeCompare(a.bucket) || b.buyers - a.buyers);
  const problemRate = n ? problemBuyers.size / n : 0;
  const upper = wilsonUpper(problemBuyers.size, n);
  const recentProblems = [...problemBuyers].filter((b) => recentBuyer.has(b)).length;
  const recentProblemRate = recentBuyer.size ? recentProblems / recentBuyer.size : null;
  const metrics = {
    ratings: reviews.stats.total || product.reviewCount,
    writtenReviews: all.length,
    buyers: n,
    textBuyers,
    usBuyers,
    lowStarBuyers: lowStar.size,
    problemBuyers: problemBuyers.size,
    problemRate,
    problemRateUpperBound: upper,
    usVariantShare,
    chinaLogisticsShare: chinaShare,
    recentReviews: all.filter((r) => isRecent(r.date, now, config.recentDays)).length,
    recentBuyers: recentBuyer.size,
    recentProblemRate,
  };
  const listingFixes = [...new Set(issues.filter((i) => i.bucket === 'A' && i.fix).map((i) => i.fix!))];
  const out = (d: Decision) => finish(d, { metrics, issues, listingFixes, sellerStrikes, flags });
  if (systemicReject.length) {
    reasons.push(`Systemic problems: ${systemicReject.join('; ')}`);
    return out('reject');
  }
  if (n < config.probationMinBuyers) {
    reasons.push(`${n} unique buyers (need ${config.probationMinBuyers}+)`);
    return out('insufficient_data');
  }

  // 4. Tier: rates with an upper bound, not fixed counts.
  const ratings = product.store.ratings;
  const strongSeller = [ratings.asDescribed, ratings.communication, ratings.shipping].every(
    (x) => x !== null && x >= config.strongSellerRating,
  );
  const rateText = `${problemBuyers.size} of ${n} buyers had problems (${pct(problemRate)}; 95% upper bound ${pct(upper)})`;
  const isImport = n >= config.importMinBuyers && textBuyers >= config.importMinTextReviews;
  const bound = isImport ? config.maxProblemUpperBound : config.probationMaxUpperBound;
  let decision: Decision;
  if (isImport && upper <= config.maxProblemUpperBound) {
    decision = 'import';
    reasons.push(rateText);
  } else if (n < config.importMinBuyers && strongSeller && upper <= config.probationMaxUpperBound) {
    decision = 'probation';
    reasons.push(`${n} buyers (${textBuyers} with text) and a strong seller: probation. ${rateText}`);
  } else {
    // Anything that doesn't pass is "not enough data" and is looked at again later, as the rules say.
    if (problemRate > bound) {
      reasons.push(`${rateText}: even the observed rate is over the ${pct(bound)} limit`);
    } else if (!isImport && n >= config.importMinBuyers) {
      reasons.push(`${n} buyers but only ${textBuyers} with written reviews (a full import needs ${config.importMinTextReviews}+)`);
    } else if (!isImport && !strongSeller) {
      reasons.push(`${n} buyers (${textBuyers} with text): a plain import needs ${config.importMinBuyers}+ buyers and ${config.importMinTextReviews}+ written reviews, and the store's ratings aren't ${config.strongSellerRating}+ for probation`);
    } else {
      reasons.push(`${rateText}: not enough buyers yet to prove the rate is under ${pct(bound)}`);
    }
    return out('insufficient_data');
  }

  // 5. Anything a person should look at first.
  if (s.suspiciousShipping) flags.push('Shipping price is implausibly low for the carrier (possible label fraud)');
  for (const c of checks) if (!c.pass && c.level === 'review') flags.push(c.detail);
  if (input.seller?.linkedTo.length) flags.push(`Store resembles blocked seller(s): ${input.seller.linkedTo.join(', ')}`);
  if (!input.imageCheck) flags.push('Images were not checked for brands or likenesses');
  if (input.imageCheck?.resemblance) flags.push(`Design resembles ${input.imageCheck.resemblance.brand}: ${input.imageCheck.resemblance.reason}`);
  // No buyer photos at all isn't a flag (the review page shows it); a comparison that never ran is.
  if (!input.photoCheck) flags.push('Buyer photos were not compared with the gallery');
  else if ((input.photoCheck.picked ?? 0) > 0 && !input.photoCheck.compared) flags.push("Buyer photos couldn't be loaded, so they weren't compared with the gallery");
  flags.push(...fakeReviewSignals(reviews, config).flags.map((f) => `Possible fake reviews: ${f}`));
  if (recentProblemRate !== null && metrics.recentBuyers >= 5 && problemRate > 0 && recentProblemRate > config.recentProblemRatio * problemRate) {
    flags.push(`Problems are rising: ${pct(recentProblemRate)} of buyers in the last ${config.recentDays} days vs ${pct(problemRate)} overall`);
  }
  if (flags.length) {
    reasons.push(...flags.map((r) => `Needs review: ${r}`));
    return out(decision === 'import' ? 'needs_review' : 'probation');
  }
  return out(decision);
}

/** Are these the seller's own reviews, for US-warehouse variants, shipped by US carriers? */
export function trustCheck(reviews: ReviewSet, config: VettingConfig, now = Date.now()) {
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
  const recent = all.filter((r) => isRecent(r.date, now, config.recentDays)).length;
  checks.push(
    check('recent_reviews', recent >= config.minRecentReviews, 'insufficient', `${recent} reviews in the last ${config.recentDays} days (need ${config.minRecentReviews}+)`),
  );
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


function plain(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Ordinary words one letter away from a brand, which must not count as misspellings. */
const NOT_MISSPELLINGS = new Set(['channel', 'chapel', 'harlem', 'metallic', 'rude', 'skins', 'skim', 'converge', 'prado', 'diesel', 'polos', 'vents']);

/** Edit distance with adjacent swaps (Damerau–Levenshtein, optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Blocked words in a title: exact matches, plus near-misses of brand names ("Addidas",
 * "Carhart", "Calvin Klien") that sellers use to dodge filters. Brand names of 5+ letters may be
 * off by one letter; 10+ letters (including spaces) by two.
 */
export function blockedTerms(text: string, blocklist: string[]): string[] {
  const hay = plain(text);
  const tokens = hay.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const hits: string[] = [];
  for (const w of blocklist) {
    const term = plain(w).trim();
    if (!term) continue;
    if (new RegExp(`\\b${escapeRe(term)}\\b`, 'i').test(hay)) {
      hits.push(term);
      continue;
    }
    // Plurals of single-word brands ("Nikes", "Levis", "Pumas").
    if (!term.includes(' ') && term.length >= 3 && tokens.includes(`${term}s`) && !NOT_MISSPELLINGS.has(`${term}s`)) {
      hits.push(`${term}s (looks like ${term})`);
      continue;
    }
    if (NON_BRAND_TERMS.has(term)) continue;
    const parts = term.replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
    const joined = parts.join(' ');
    if (joined.length < 5) continue;
    const allowed = joined.length >= 10 ? 2 : 1;
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      const window = tokens.slice(i, i + parts.length).join(' ');
      if (window === joined || NOT_MISSPELLINGS.has(window)) continue;
      if (window[0] !== joined[0] || Math.abs(window.length - joined.length) > allowed) continue;
      if (editDistance(window, joined) <= allowed) {
        hits.push(`${window} (looks like ${term})`);
        break;
      }
    }
  }
  return hits;
}
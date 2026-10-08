import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProduct } from '../src/core/aliexpress/parse.ts';
import { parseReviewPage } from '../src/core/reviews/reviews.ts';
import type { FreightQuote, ProductSnapshot, Review, ReviewSet } from '../src/core/types.ts';
import { DEFAULT_CONFIG } from '../src/core/vetting/config.ts';
import { blockedTerms, type PhotoCheck, type ReviewAnalysis, parseSkuInfo, screen, vet } from '../src/core/vetting/engine.ts';
import { profitCents, retailPriceCents } from '../src/core/vetting/pricing.ts';
import { buyersNeeded, fakeReviewSignals, wilsonUpper } from '../src/core/vetting/stats.ts';

const NOW = Date.parse('2026-10-08T12:00:00Z');

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const cargo = (): ProductSnapshot => parseProduct(fx('product_cargo.json'), '3256811859422872');
const xghs = (): ProductSnapshot => parseProduct(fx('product_xghs_limited.json'), '3256812555436716');

function quotes(p: ProductSnapshot, carrier = 'US AliExpress Delivery-Saver', feeCents = 299, days: [number, number] = [3, 6]): FreightQuote[] {
  return p.skus.map((s) => ({
    skuId: s.skuId,
    quantity: 1,
    error: null,
    options: [{ carrier, code: 'X', shipFrom: 'US', feeCents, free: false, minDays: days[0], maxDays: days[1], guaranteedDays: 30, tracking: true }],
  }));
}

let seq = 0;
function review(o: Partial<Review> = {}): Review {
  seq++;
  return {
    id: `r${seq}`,
    buyer: `B***${seq}`,
    anonymous: false,
    country: 'US',
    stars: 5,
    date: `2026-08-${String((seq % 28) + 1).padStart(2, '0')}`,
    skuInfo: 'Color:3PCS Size:L Ships From:United States',
    shipsFromUS: true,
    logistics: 'USPS Priority Mail',
    text: '',
    additionalText: '',
    images: 0,
    labels: {},
    selected: false,
    ...o,
  };
}

function set(reviews: Review[], extra: Partial<ReviewSet> = {}): ReviewSet {
  const byStars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSet['stats']['byStars'];
  reviews.forEach((r) => (byStars[r.stars as 1] += 1));
  return {
    mainId: 'm',
    productType: 'ORDINARY',
    pooledNotice: null,
    stats: { total: reviews.length, avg: null, byStars },
    filterCounts: {},
    reviews,
    complete: true,
    sampled: false,
    fetchedAt: 0,
    ...extra,
  };
}

const many = (n: number, o: Partial<Review> = {}) => Array.from({ length: n }, () => review({ text: 'good, fits well', ...o }));

const noIssues: ReviewAnalysis = { issues: [], fit: [], materialFromReviews: null, summary: '' };

describe('screen', () => {
  it('passes the cargo pants and picks the US shipping quote', () => {
    const s = screen(cargo(), quotes(cargo()), DEFAULT_CONFIG);
    expect(s.pass).toBe(true);
    expect(s.usSkuIds).toHaveLength(5);
    expect(s.shipping).toMatchObject({ feeCents: 299, maxDays: 6 });
    expect(s.suspiciousShipping).toBe(false);
  });

  it('flags a $3 tee sent by Priority Mail for $2.99', () => {
    const p = xghs();
    const s = screen(p, quotes(p, 'USPS Priority Mail', 299, [6, 12]), DEFAULT_CONFIG);
    expect(s.suspiciousShipping).toBe(true);
    expect(s.checks.find((c) => c.id === 'shipping_plausible')?.pass).toBe(false);
  });

  it('rejects weak store ratings and brand names', () => {
    const p = cargo();
    p.store.ratings.communication = 4.4;
    p.title = 'Men Ariat cargo pants';
    const s = screen(p, quotes(p), DEFAULT_CONFIG);
    expect(s.pass).toBe(false);
    expect(s.checks.filter((c) => !c.pass).map((c) => c.id)).toEqual(expect.arrayContaining(['store_ratings', 'ip_title']));
  });

  it('flags delivery promises over 7 days', () => {
    const s = screen(cargo(), quotes(cargo(), 'US AliExpress Delivery-Saver', 299, [6, 10]), DEFAULT_CONFIG);
    expect(s.checks.find((c) => c.id === 'delivery_window')).toMatchObject({ pass: false, level: 'review' });
  });

  it('blocks "dupe", "replica", "inspired" and misspelled brands', () => {
    const p = cargo();
    p.title = 'Mens Addidas Style Track Pants Replica';
    const s = screen(p, quotes(p), DEFAULT_CONFIG);
    expect(s.checks.find((c) => c.id === 'ip_title')?.detail).toMatch(/replica.*addidas \(looks like adidas\)|addidas.*replica/);
  });

  it('marks a 19-review listing as not yet vettable', () => {
    const p = cargo();
    p.reviewCount = 19;
    expect(screen(p, quotes(p), DEFAULT_CONFIG).checks.find((c) => c.id === 'review_count')?.pass).toBe(false);
  });
});

describe('vet', () => {
  const clean = { compared: 4, mismatches: [], quality: 'Fabric looks as pictured' } satisfies PhotoCheck;
  const base = (p: ProductSnapshot, reviews: ReviewSet | null, analysis: ReviewAnalysis | null = noIssues, config = DEFAULT_CONFIG, photoCheck: PhotoCheck | null = clean) =>
    vet({ product: p, freight: quotes(p), reviews, analysis, imageCheck: { ipRisk: false, findings: [] }, photoCheck, seller: null, config, now: NOW });

  it('imports the cargo pants with listing fixes (70 buyers, no absorbable problems)', () => {
    const rs = [
      ...Array.from({ length: 60 }, (_, i) => review({ stars: 5, text: i < 18 ? 'Fit great, comfortable' : '' })),
      ...Array.from({ length: 10 }, (_, i) => review({ stars: 4, text: i < 2 ? 'Zippers are decorative' : '' })),
    ];
    const zipper = rs.filter((r) => r.text.includes('Zippers')).map((r) => r.id);
    const analysis: ReviewAnalysis = {
      ...noIssues,
      issues: [
        { category: 'decorative_feature', reviewIds: zipper, quote: 'Zippers are decorative' },
        { category: 'fit_large', reviewIds: [rs[0]!.id, rs[1]!.id, rs[2]!.id], quote: 'Fit great' },
      ],
    };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('import');
    expect(r.metrics.buyers).toBe(70);
    expect(r.metrics.problemRate).toBe(0);
    expect(r.metrics.problemRateUpperBound).toBeCloseTo(wilsonUpper(0, 70));
    expect(r.listingFixes.join(' ')).toMatch(/Disclose/);
    expect(r.issues.find((i) => i.category === 'decorative_feature')?.bucket).toBe('A');
  });

  it('asks for more buyers when one problem leaves the upper bound over 5%', () => {
    const rs = many(60);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'hole_or_tear', reviewIds: [rs[0]!.id], quote: 'good' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('insufficient_data');
    expect(r.reasons.join(' ')).toMatch(/not enough buyers yet/);
  });

  it('treats an observed rate over the limit as not enough data, to be rechecked', () => {
    const rs = many(60);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'stitching_defect', reviewIds: rs.slice(0, 4).map((r) => r.id), quote: 'good' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('insufficient_data');
    expect(r.reasons.join(' ')).toMatch(/even the observed rate is over/);
    expect(r.metrics.problemRate).toBeCloseTo(4 / 60);
  });

  it('counts unexplained low ratings as problems', () => {
    const rs = many(100);
    rs[0]!.stars = 1;
    const r = base(cargo(), set(rs));
    expect(r.issues[0]?.category).toBe('unexplained_low_rating');
    expect(r.metrics.problemBuyers).toBe(1);
    expect(r.decision).toBe('import'); // 1 of 100: bound 4.6%
  });

  it('rejects an unfixable problem reported by 2+ buyers and more than 1%', () => {
    const rs = many(120);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'wash_durability', reviewIds: [rs[8]!.id, rs[9]!.id], quote: 'good' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('reject');
    expect(r.reasons.join(' ')).toMatch(/after washing/);
  });

  it('only flags 2 reports of an unfixable problem when they are 1% of buyers or less', () => {
    const rs = many(250);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'wash_durability', reviewIds: [rs[8]!.id, rs[9]!.id], quote: 'good' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('needs_review');
    expect(r.flags?.join(' ')).toMatch(/after washing/);
  });

  it('rejects fake postage on one report and records seller strikes', () => {
    const p = xghs();
    p.reviewCount = 100;
    const rs = many(60, { skuInfo: 'Color:Black Size:M Ships From:United States' });
    rs[0]!.text = 'Never got the package. It got flagged for fraudulent shipping… they used fake postage.';
    rs[0]!.stars = 1;
    rs[1]!.text = 'Never received!!!';
    rs[1]!.stars = 2;
    rs[2]!.text = 'Never received!!!';
    const analysis: ReviewAnalysis = {
      ...noIssues,
      issues: [
        { category: 'fake_tracking', reviewIds: [rs[0]!.id], quote: 'flagged for fraudulent shipping… they used fake postage' },
        { category: 'non_delivery', reviewIds: [rs[0]!.id, rs[1]!.id, rs[2]!.id], quote: 'Never received!!!' },
      ],
    };
    const r = vet({ product: p, freight: quotes(p, 'USPS Priority Mail', 299, [3, 6]), reviews: set(rs), analysis, imageCheck: null, seller: null, config: DEFAULT_CONFIG, now: NOW });
    expect(r.decision).toBe('reject');
    expect(r.sellerStrikes).toEqual(expect.arrayContaining(['fake_tracking', 'non_delivery']));
  });

  it('does not reject on unfixable reports whose quotes were not found', () => {
    const rs = many(120);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'wash_durability', reviewIds: [rs[0]!.id, rs[1]!.id], quote: 'peeled after washing' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).not.toBe('reject');
    expect(r.flags?.join(' ')).toMatch(/wasn't found/);
  });

  it('sends 60+ buyers with too few written reviews to not enough data, not probation', () => {
    const strong = cargo();
    strong.store.ratings = { asDescribed: 4.8, communication: 4.8, shipping: 4.9 };
    const rs = [...many(10), ...Array.from({ length: 60 }, () => review({ text: '' }))];
    expect(base(strong, set(rs)).decision).toBe('insufficient_data');
  });

  it('flags, rather than ignores, a quote that is not in the review', () => {
    const rs = many(70);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'fake_tracking', reviewIds: [rs[0]!.id], quote: 'they used fake postage' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).not.toBe('reject');
    expect(r.sellerStrikes).toHaveLength(0);
    expect(r.flags?.join(' ')).toMatch(/wasn't found in the cited review/);
  });

  it('a size complaint does not excuse a 1-star review', () => {
    const rs = many(30);
    rs[0]!.stars = 1;
    rs[0]!.text = 'Seam ripped after one wear and it runs small';
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'fit_small', reviewIds: [rs[0]!.id], quote: 'runs small' }] };
    expect(base(cargo(), set(rs), analysis).issues.map((i) => i.category)).toContain('unexplained_low_rating');
  });

  it('compares fit per measurement: loose waist and short inseam is not inconsistency', () => {
    const rs = many(70);
    const fitE = (r: Review, direction: 'large' | 'small', dimension: string) => ({ reviewId: r.id, direction, dimension, heightIn: null, weightLb: null });
    const analysis: ReviewAnalysis = { ...noIssues, fit: rs.slice(0, 3).flatMap((r) => [fitE(r, 'large', 'waist'), fitE(r, 'small', 'inseam')]) };
    expect(base(cargo(), set(rs), analysis).issues.find((i) => i.category === 'fit_inconsistent')).toBeUndefined();
  });

  it('treats sizing that runs both big and small as a factory problem', () => {
    const rs = many(70);
    const analysis: ReviewAnalysis = {
      ...noIssues,
      fit: [
        ...rs.slice(0, 3).map((r) => ({ reviewId: r.id, direction: 'large' as const, dimension: 'overall', heightIn: null, weightLb: null })),
        ...rs.slice(3, 5).map((r) => ({ reviewId: r.id, direction: 'small' as const, dimension: 'overall', heightIn: null, weightLb: null })),
      ],
    };
    const r = base(cargo(), set(rs), analysis);
    expect(r.issues.find((i) => i.category === 'fit_inconsistent')).toBeTruthy();
    expect(r.decision).toBe('reject');
  });

  it('cannot judge a seller from pooled reviews', () => {
    const pooled = parseReviewPage(fx('reviews_pooled_acid_tee.json'));
    const rs: ReviewSet = { mainId: 'm', ...pooled.set, reviews: pooled.reviews, complete: true, sampled: false, fetchedAt: 0 };
    const r = base(cargo(), rs);
    expect(r.decision).toBe('insufficient_data');
    expect(r.reasons.join(' ')).toMatch(/pooled/);
  });

  it('needs 5 reviews from the last 90 days', () => {
    const r = base(cargo(), set(many(70, { date: '2026-03-01' })));
    expect(r.decision).toBe('insufficient_data');
    expect(r.reasons.join(' ')).toMatch(/0 reviews in the last 90 days/);
  });

  it('puts a strong seller with 20–59 buyers on probation only when it passes the bound', () => {
    const strong = cargo();
    strong.store.ratings = { asDescribed: 4.8, communication: 4.8, shipping: 4.9 };
    expect(base(strong, set(many(55))).decision).toBe('probation'); // 0 of 55: bound 4.7%
    expect(base(strong, set(many(25))).decision).toBe('insufficient_data'); // 0 of 25: bound 9.8%
    expect(base(strong, set(many(25)), noIssues, { ...DEFAULT_CONFIG, probationMaxUpperBound: 0.12 }).decision).toBe('probation');
    const average = cargo();
    average.store.ratings = { asDescribed: 4.6, communication: 4.6, shipping: 4.6 };
    expect(base(average, set(many(55))).decision).toBe('insufficient_data');
    expect(base(strong, set(many(19))).decision).toBe('insufficient_data');
  });

  it('ignores review ids the model invented', () => {
    const rs = many(70);
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'hole_or_tear', reviewIds: ['made-up'], quote: 'x' }] };
    expect(base(cargo(), set(rs), analysis).decision).toBe('import');
  });

  it('rejects when the image check finds a likeness, and flags a brand resemblance', () => {
    const rs = many(70);
    const r = vet({ product: cargo(), freight: quotes(cargo()), reviews: set(rs), analysis: noIssues, imageCheck: { ipRisk: true, findings: ['Photo of a real musician'] }, seller: null, config: DEFAULT_CONFIG, now: NOW });
    expect(r.decision).toBe('reject');
    const looks = vet({
      product: cargo(), freight: quotes(cargo()), reviews: set(rs), analysis: noIssues, photoCheck: clean, seller: null, config: DEFAULT_CONFIG, now: NOW,
      imageCheck: { ipRisk: false, findings: [], resemblance: { brand: 'Gallery Dept', reason: 'paint-splatter flared sweatpants' } },
    });
    expect(looks.decision).toBe('needs_review');
    expect(looks.flags?.join(' ')).toMatch(/resembles Gallery Dept/);
  });

  it('treats buyer photos that clearly differ from the gallery as an unfixable problem', () => {
    const rs = many(70);
    const r = base(cargo(), set(rs), noIssues, DEFAULT_CONFIG, { compared: 5, quality: '', mismatches: [{ reviewId: rs[0]!.id, detail: 'different print' }, { reviewId: rs[1]!.id, detail: 'cropped, not full length' }] });
    expect(r.decision).toBe('reject');
    expect(r.issues.find((i) => i.category === 'not_as_pictured')?.buyers).toBe(2);
  });

  it('flags a product whose problems are rising', () => {
    const old = many(70, { date: '2026-05-01' });
    const recent = many(30, { date: '2026-09-20' });
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'stitching_defect', reviewIds: [recent[0]!.id], quote: 'good' }] };
    const r = base(cargo(), set([...old, ...recent]), analysis);
    expect(r.flags?.join(' ')).toMatch(/Problems are rising/);
  });
});

describe('statistics', () => {
  it('matches the Wilson numbers in the rules', () => {
    expect(wilsonUpper(0, 52)).toBeLessThanOrEqual(0.05);
    expect(wilsonUpper(0, 51)).toBeGreaterThan(0.05);
    expect(buyersNeeded(0, 0.05)).toBe(52);
    expect(buyersNeeded(1, 0.05)).toBe(87);
  });

  it('spots review bursts, copied text and silent 5-star ratings', () => {
    const burst = [
      ...Array.from({ length: 12 }, (_, i) => review({ date: '2026-09-01', text: `nice ${i}` })),
      ...Array.from({ length: 4 }, (_, i) => review({ date: `2026-08-0${i + 1}`, text: `ok ${i}` })),
    ];
    expect(fakeReviewSignals(set(burst), DEFAULT_CONFIG).flags.join(' ')).toMatch(/reviewed on 3 days/);
    const copied = Array.from({ length: 3 }, () => review({ text: 'Very good quality shirt fast shipping recommend seller' }));
    expect(fakeReviewSignals(set([...copied, ...many(10)]), DEFAULT_CONFIG).duplicateReviewIds).toHaveLength(3);
    const silent = set(many(10), { stats: { total: 100, avg: 4.9, byStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 100 } }, writtenTotal: 10 });
    expect(fakeReviewSignals(silent, DEFAULT_CONFIG).flags.join(' ')).toMatch(/90% of all ratings are 5 stars with no text/);
  });

  it('catches brand misspellings without catching ordinary words', () => {
    const list = DEFAULT_CONFIG.ipBlocklist;
    expect(blockedTerms('Carhart Style Work Jacket', list)).toEqual(['carhart (looks like carhartt)']);
    expect(blockedTerms('Calvin Klien boxer briefs', list)[0]).toMatch(/calvin klien/);
    expect(blockedTerms('Vintage-Inspired Denim Jacket', list)).toEqual(['inspired']);
    expect(blockedTerms('Channel Quilted Puffer Jacket', list)).toEqual([]);
    expect(blockedTerms('Metallic Off-White Rude Boy Skins Tee', list)).toEqual([]);
    expect(blockedTerms('Nikes and Levis style', list)).toEqual(['nikes (looks like nike)', 'levis (looks like levi)']);
    expect(blockedTerms("Men's Cargo Jogger Pants 3-Pack", list)).toEqual([]);
  });
});

describe('helpers', () => {
  it('parses variant info with spaces in values', () => {
    expect(parseSkuInfo('Color:Black Size:XL 85-100KG Ships From:United States')).toEqual({
      Color: 'Black', Size: 'XL 85-100KG', 'Ships From': 'United States',
    });
    expect(parseSkuInfo('Color:LHT13-5P2 Size:M Sale by Pack:Pack of 5 Ships From:United States').Size).toBe('M');
    expect(parseSkuInfo('Color:Yellow Size:Men M Ships From:United States').Size).toBe('Men M');
  });

  it('prices from break-even with a return reserve and payment fees', () => {
    // ($13 + $3.80 reserve + $8 profit + $0.30) ÷ 0.971 = $25.85 → $25.99
    expect(retailPriceCents(1300, DEFAULT_CONFIG.pricing)).toBe(2599);
    expect(profitCents(2599, 1300, DEFAULT_CONFIG.pricing)).toBeGreaterThanOrEqual(800);
    // With $7 profit the same cost gives $24.99.
    expect(retailPriceCents(1300, { ...DEFAULT_CONFIG.pricing, profitCents: 700 })).toBe(2499);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProduct } from '../src/aliexpress/parse.ts';
import { parseReviewPage } from '../src/reviews/reviews.ts';
import type { FreightQuote, ProductSnapshot, Review, ReviewSet } from '../src/types.ts';
import { DEFAULT_CONFIG } from '../src/vetting/config.ts';
import { type ReviewAnalysis, parseSkuInfo, screen, vet } from '../src/vetting/engine.ts';

import { retailPriceCents } from '../src/vetting/pricing.ts';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const cargo = (): ProductSnapshot => parseProduct(fx('product_cargo.json'), '3256811859422872');
const xghs = (): ProductSnapshot => parseProduct(fx('product_xghs_limited.json'), '3256812555436716');

function quotes(p: ProductSnapshot, carrier = 'US AliExpress Delivery-Saver', feeCents = 299, days: [number, number] = [6, 10]): FreightQuote[] {
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

const noIssues: ReviewAnalysis = { issues: [], fit: [], materialFromReviews: null, summary: '' };

describe('screen', () => {
  it('passes the cargo pants and picks the US shipping quote', () => {
    const s = screen(cargo(), quotes(cargo()), DEFAULT_CONFIG);
    expect(s.pass).toBe(true);
    expect(s.usSkuIds).toHaveLength(5);
    expect(s.shipping).toMatchObject({ feeCents: 299, maxDays: 10 });
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

  it('marks a 9-review listing as not yet vettable', () => {
    const p = cargo();
    p.reviewCount = 9;
    expect(screen(p, quotes(p), DEFAULT_CONFIG).checks.find((c) => c.id === 'review_count')?.pass).toBe(false);
  });
});

describe('vet', () => {
  const base = (p: ProductSnapshot, reviews: ReviewSet | null, analysis: ReviewAnalysis | null = noIssues) =>
    vet({ product: p, freight: quotes(p), reviews, analysis, imageCheck: { ipRisk: false, findings: [] }, seller: null, config: DEFAULT_CONFIG });

  it('imports the cargo pants with listing fixes (34 buyers, no absorbable problems)', () => {
    const rs = [
      ...Array.from({ length: 27 }, (_, i) => review({ stars: 5, text: i < 10 ? 'Fit great, comfortable' : '' })),
      ...Array.from({ length: 7 }, (_, i) => review({ stars: 4, text: i < 2 ? 'Zippers are decorative' : '' })),
    ];
    const zipper = rs.filter((r) => r.text.includes('Zippers')).map((r) => r.id);
    const analysis: ReviewAnalysis = {
      ...noIssues,
      issues: [
        { category: 'decorative_feature', reviewIds: zipper, quote: 'the zippers are decorative features' },
        { category: 'fit_large', reviewIds: [rs[0]!.id, rs[1]!.id, rs[2]!.id], quote: 'a little big' },
      ],
    };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('import');
    expect(r.metrics.buyers).toBe(34);
    expect(r.metrics.problemRate).toBe(0);
    expect(r.metrics.problemRateUpperBound).toBeCloseTo(3 / 34);
    expect(r.listingFixes.join(' ')).toMatch(/Disclose/);
    expect(r.issues.find((i) => i.category === 'decorative_feature')?.bucket).toBe('A');
  });

  it('rejects when absorbable problems exceed 1 in 40', () => {
    const rs = Array.from({ length: 40 }, (_, i) => review({ text: 'ok', stars: i < 2 ? 2 : 5 }));
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'hole_or_tear', reviewIds: [rs[0]!.id, rs[1]!.id], quote: 'hole' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('reject');
    expect(r.metrics.problemRate).toBeCloseTo(0.05);
  });

  it('counts unexplained low ratings as problems', () => {
    const rs = Array.from({ length: 30 }, (_, i) => review({ text: 'fine', stars: i === 0 ? 1 : 5 }));
    const r = base(cargo(), set(rs));
    expect(r.issues[0]?.category).toBe('unexplained_low_rating');
    expect(r.decision).toBe('reject'); // 1 of 30 = 3.3% > 2.5%
  });

  it('rejects the custom tee: holes, misprints and peeling prints are systemic', () => {
    const rs = Array.from({ length: 120 }, () => review({ text: 'great' }));
    const ids = (from: number, n: number) => rs.slice(from, from + n).map((r) => r.id);
    const analysis: ReviewAnalysis = {
      ...noIssues,
      issues: [
        { category: 'hole_or_tear', reviewIds: ids(0, 4), quote: 'Received a shirt with a hole' },
        { category: 'misprint', reviewIds: ids(4, 4), quote: 'pictures on the shirt were both crooked' },
        { category: 'wash_durability', reviewIds: ids(8, 2), quote: 'Print came off after 3 washes' },
      ],
    };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).toBe('reject');
    expect(r.reasons.join(' ')).toMatch(/after washing/);
  });

  it('rejects fake postage outright and records a seller strike', () => {
    const p = xghs();
    const rs = Array.from({ length: 50 }, () => review({ text: 'nice', skuInfo: 'Color:Black Size:M Ships From:United States' }));
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
    const r = vet({ product: p, freight: quotes(p, 'USPS Priority Mail', 299, [6, 12]), reviews: set(rs), analysis, imageCheck: null, seller: null, config: DEFAULT_CONFIG });
    expect(r.decision).toBe('reject');
    expect(r.sellerStrikes).toEqual(expect.arrayContaining(['fake_tracking', 'non_delivery']));
  });

  it('does not reject or strike a seller on a quote that is not in the review', () => {
    const rs = Array.from({ length: 50 }, () => review({ text: 'nice shirt' }));
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'fake_tracking', reviewIds: [rs[0]!.id], quote: 'they used fake postage' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.decision).not.toBe('reject');
    expect(r.sellerStrikes).toHaveLength(0);
    expect(r.reasons.join(' ')).toMatch(/quote not found/);
  });

  it('a size complaint does not excuse a 1-star review', () => {
    const rs = Array.from({ length: 30 }, () => review({ text: 'good' }));
    rs[0]!.stars = 1;
    rs[0]!.text = 'Seam ripped after one wear and it runs small';
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'fit_small', reviewIds: [rs[0]!.id], quote: 'runs small' }] };
    const r = base(cargo(), set(rs), analysis);
    expect(r.issues.map((i) => i.category)).toContain('unexplained_low_rating');
    expect(r.decision).toBe('reject');
  });

  it('compares fit per measurement: loose waist and short inseam is not inconsistency', () => {
    const rs = Array.from({ length: 40 }, () => review({ text: 'fit comment' }));
    const fitE = (r: Review, direction: 'large' | 'small', dimension: string) => ({ reviewId: r.id, direction, dimension, heightIn: null, weightLb: null });
    const analysis: ReviewAnalysis = {
      ...noIssues,
      fit: rs.slice(0, 3).flatMap((r) => [fitE(r, 'large', 'waist'), fitE(r, 'small', 'inseam')]),
    };
    expect(base(cargo(), set(rs), analysis).issues.find((i) => i.category === 'fit_inconsistent')).toBeUndefined();
  });

  it('treats sizing that runs both big and small as a factory problem', () => {
    const rs = Array.from({ length: 40 }, () => review({ text: 'size comment' }));
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

  it('puts 15 buyers with a strong seller on probation, and with an average seller asks for more data', () => {
    const rs = Array.from({ length: 15 }, () => review({ text: 'good' }));
    const strong = cargo();
    strong.store.ratings = { asDescribed: 4.8, communication: 4.8, shipping: 4.9 };
    expect(base(strong, set(rs)).decision).toBe('probation');
    const average = cargo();
    average.store.ratings = { asDescribed: 4.6, communication: 4.6, shipping: 4.6 };
    expect(base(average, set(rs)).decision).toBe('insufficient_data');
  });

  it('holds an otherwise clean import for review when one buyer reports a systemic issue', () => {
    const rs = Array.from({ length: 40 }, () => review({ text: 'good' }));
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'wash_durability', reviewIds: [rs[0]!.id], quote: 'shrank' }] };
    expect(base(cargo(), set(rs), analysis).decision).toBe('needs_review');
  });

  it('ignores review ids the model invented', () => {
    const rs = Array.from({ length: 40 }, () => review({ text: 'good' }));
    const analysis: ReviewAnalysis = { ...noIssues, issues: [{ category: 'hole_or_tear', reviewIds: ['made-up'], quote: 'x' }] };
    expect(base(cargo(), set(rs), analysis).decision).toBe('import');
  });

  it('rejects when the image check finds a likeness', () => {
    const rs = Array.from({ length: 40 }, () => review({ text: 'good' }));
    const r = vet({ product: cargo(), freight: quotes(cargo()), reviews: set(rs), analysis: noIssues, imageCheck: { ipRisk: true, findings: ['Photo of a real musician'] }, seller: null, config: DEFAULT_CONFIG });
    expect(r.decision).toBe('reject');
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

  it('prices to .99 with the markup or the minimum profit, whichever is higher', () => {
    // $25.92 landed × 1.8 = $46.66 → $46.99
    expect(retailPriceCents(2592, DEFAULT_CONFIG.pricing)).toBe(4699);
    // $5.00 landed: markup gives $9.00 but min profit $7 → $12.00 → $12.99
    expect(retailPriceCents(500, DEFAULT_CONFIG.pricing)).toBe(1299);
  });
});

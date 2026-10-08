import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AliExpressClient } from '../src/core/aliexpress/client.ts';
import type { Part, StructuredModel } from '../src/core/ai/claude.ts';
import type { CandidateDoc } from '../src/core/firestore/model.ts';
import { MemoryRepo } from '../src/core/firestore/repo.ts';
import { advanceWork, monitorProduct, newWork, type PipelineContext } from '../src/core/stages.ts';
import type { ReviewPage } from '../src/core/reviews/reviews.ts';
import type { Review, ReviewSet } from '../src/core/types.ts';
import { DEFAULT_CONFIG } from '../src/core/vetting/config.ts';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

function aeFetch(productFixture: string, freightFixture = 'freight_paid.json', override?: (body: URLSearchParams) => unknown) {
  return (async (_url: string | URL, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ''));
    const o = override?.(body);
    if (o) return new Response(JSON.stringify(o));
    const method = body.get('method');
    if (method === 'aliexpress.ds.product.get') return new Response(JSON.stringify(fx(productFixture)));
    if (method === 'aliexpress.ds.freight.query') return new Response(JSON.stringify(fx(freightFixture)));
    throw new Error(`unexpected ${method}`);
  }) as typeof fetch;
}

/** A 1x1 JPEG-ish payload: enough for the loader to accept it as an image. */
const imageFetch = (async () => new Response(new Uint8Array([0xff, 0xd8, ...new Array(200).fill(1)]))) as unknown as typeof fetch;

/** Answers each AI call from its system prompt, so the whole pipeline runs without the API. */
class FakeModel implements StructuredModel {
  calls: string[] = [];
  constructor(private readonly answers: Record<string, (parts: Part[]) => unknown>) {}
  async generate<T>(o: { system: string; parts: Part[]; schema: z.ZodType<T> }): Promise<T> {
    const key = Object.keys(this.answers).find((k) => o.system.includes(k));
    if (!key) throw new Error(`no fake answer for: ${o.system.slice(0, 60)}`);
    this.calls.push(key);
    return o.schema.parse(this.answers[key]!(o.parts));
  }
}

let n = 0;
const review = (o: Partial<Review> = {}): Review => ({
  id: `r${++n}`, buyer: `B***${n}`, anonymous: false, country: 'US', stars: 5, date: '2026-09-01',
  skuInfo: 'Color:3PCS Size:L Ships From:United States', shipsFromUS: true, logistics: 'USPS Priority Mail',
  text: 'Comfortable, a little big', additionalText: '', images: 0, labels: {}, selected: false, ...o,
});
const reviewSet = (reviews: Review[]): ReviewSet => ({
  mainId: 'm', productType: 'ORDINARY', pooledNotice: null,
  stats: { total: reviews.length, avg: 4.8, byStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: reviews.length } },
  filterCounts: {}, reviews, complete: true, sampled: false, fetchedAt: 0,
});

const cand = (subId: string, department: 'men' = 'men'): CandidateDoc => ({
  subId, mainId: null, feeds: ['AEB_US Local Items'], title: 'x', department, categoryId: '200000343', subcategoryName: 'Pants',
  shopId: null, recentSales: 10, feedPriceCents: 1298, status: 'new', reasons: [], nextCheckAt: null, attempts: 0, createdAt: 0, updatedAt: 0,
});

const cleanAnswers = (reviews: Review[]): Record<string, (p: Part[]) => unknown> => ({
  'check product photos': () => ({ ipRisk: false, findings: [], printDescription: 'plain' }),
  'read customer reviews': () => ({
    issues: [{ category: 'decorative_feature', reviewIds: [reviews[0]!.id, reviews[1]!.id], quote: 'the zippers are decorative' }],
    fit: [{ reviewId: reviews[2]!.id, direction: 'large', dimension: 'waist', heightIn: 72, weightLb: null }],
    materialFromReviews: 'polyester',
    summary: 'Comfortable; zippers are decorative.',
  }),
  "read a clothing seller's size chart": () => ({
    found: true, imageIndex: 0, unit: 'cm', measurementType: 'garment',
    rows: ['S', 'M', 'L', 'XL', 'XXL'].map((size, i) => ({ size, measurements: [{ name: 'waist', value: 74 + i * 4 }, { name: 'inseam', value: 74.5 + i }] })),
    notes: '',
  }),
  'build a US size guide': () => ({
    fitType: 'Relaxed jogger, elastic waist',
    rows: ['S', 'M', 'L', 'XL', 'XXL'].map((size, i) => ({ size, fitsBody: [{ measure: 'waist', min: 28 + i * 3, max: 30 + i * 3 }], usSizeLabel: size, confidence: 'medium' })),
    fitNotes: ['Runs slightly large: size down if between sizes'],
    reasoning: 'Elastic waist; US reviews say large.',
  }),
  'write the US product page': () => ({
    title: "Men's Cargo Jogger Pants, 3-Pack – Elastic Waist",
    handle: 'mens-cargo-jogger-pants-3-pack',
    storeCategory: 'joggers',
    seo: { title: "Men's Cargo Jogger Pants 3-Pack | Elastic Waist", metaDescription: 'Three relaxed cargo joggers in black, olive and khaki. Ships from the US.', primaryKeyword: "men's cargo jogger pants", secondaryKeywords: ['cargo joggers 3 pack'] },
    bullets: ['3 pairs: black, olive and khaki', 'Side-pocket zippers are decorative', 'Runs slightly large: size down if between sizes', 'Polyester'],
    description: ['Relaxed cargo joggers with an elastic drawstring waist.'],
    faq: [{ q: 'Do the zippers work?', a: 'No, they are decorative.' }],
    variants: ['12000057474585431', '12000057474585432', '12000057474585433', '12000057474585434', '12000057474585435'].map((skuId, i) => ({ skuId, color: '3-Pack: Black, Olive, Khaki', size: ['S', 'M', 'L', 'XL', 'XXL'][i]! })),
    imageAlts: [{ index: 0, alt: "Men's cargo jogger pants in black, olive and khaki" }],
    claims: [{ text: 'Side-pocket zippers are decorative', evidenceIds: ['E1'] }],
  }),
});

/** Serves a review set 20 at a time, the way the review endpoint pages it. */
function pagesOf(set: ReviewSet) {
  return async (_mainId: string, page: number): Promise<ReviewPage> => {
    const { mainId: _m, reviews, complete: _c, sampled: _s, fetchedAt: _f, ...rest } = set;
    return { set: rest, reviews: reviews.slice((page - 1) * 20, page * 20), totalPages: Math.max(1, Math.ceil(reviews.length / 20)), writtenTotal: reviews.length };
  };
}

function ctx(repo: MemoryRepo, fetchImpl: typeof fetch, model: StructuredModel, reviews: ReviewSet): PipelineContext {
  repo.secretsDoc = { aeAccessToken: 't', aeRefreshToken: 'r', aeExpiresAt: Date.now() + 3600e3 };
  return {
    ae: new AliExpressClient({ appKey: 'k', appSecret: 's', tokens: repo.tokenStore(), fetchImpl, sleep: async () => {}, minIntervalMs: 0 }),
    repo, model: () => model, models: { fast: 'fast', careful: 'careful' }, config: DEFAULT_CONFIG, log: () => {},
    fetchReviewPage: pagesOf(reviews), fetchImpl: imageFetch, sleep: async () => {},
  };
}

/** Runs a candidate through every stage, the way repeated dashboard steps would. */
async function processCandidate(c: PipelineContext, candidate: CandidateDoc) {
  await c.repo.upsertCandidates([candidate]);
  let work = newWork(candidate, Date.now());
  await c.repo.saveWork(work);
  for (let i = 0; i < 40; i++) {
    const r = await advanceWork(c, work);
    if (r.finished) return { outcome: r.outcome!, reasons: r.reasons ?? [], productId: r.productId };
    work = (await c.repo.getWork(candidate.subId))!;
  }
  throw new Error('did not finish');
}

describe('processCandidate', () => {
  it('imports, prices and publishes the cargo pants with listing fixes applied', async () => {
    const rs = Array.from({ length: 34 }, () => review());
    const repo = new MemoryRepo();
    // The real listing has no Material attribute; give it one so the listing can go live.
    const product = fx('product_cargo.json');
    product.aliexpress_ds_product_get_response.result.ae_item_properties.ae_item_property.push({ attr_name: 'Material', attr_value: 'POLYESTER' });
    const fetchImpl = aeFetch('product_cargo.json', 'freight_paid.json', (b) => (b.get('method') === 'aliexpress.ds.product.get' ? product : undefined));
    const model = new FakeModel(cleanAnswers(rs));
    const out = await processCandidate(ctx(repo, fetchImpl, model, reviewSet(rs)), cand('3256811859422872'));

    expect(out.outcome).toBe('published');
    const p = repo.products.get('ae-1005012045737624')!;
    expect(p.status).toBe('live');
    expect(p.material).toBe('Polyester');
    expect(p.origin).toBe('Imported');
    // $22.93 + $2.99 = $25.92 landed × 1.8 → $46.99; XXL $21.78 + $2.99 → $44.31 → $44.99
    expect(p.priceToCents).toBe(4699);
    expect(p.priceFromCents).toBe(4499);
    expect(p.variants.every((v) => v.color === '3-Pack: Black, Olive, Khaki')).toBe(true);
    expect(p.sizeChart?.rows[0]?.garment.waist).toBeCloseTo(29.1, 1);
    const s = repo.sourcing.get(p.id)!;
    expect(s.skus.find((k) => k.aeSkuId === '12000057474585433')?.landedCents).toBe(2592);
    expect(repo.vetting.get(p.id)?.result.decision).toBe('import');
    expect(repo.candidates.get('3256811859422872')?.status).toBe('published');
    expect(repo.work.size).toBe(0);
    expect(model.calls).toEqual(expect.arrayContaining(['check product photos', 'read customer reviews', 'write the US product page']));
  });

  it('holds the real cargo listing for review because its material is unknown', async () => {
    const rs = Array.from({ length: 34 }, () => review());
    const repo = new MemoryRepo();
    const out = await processCandidate(ctx(repo, aeFetch('product_cargo.json'), new FakeModel({ ...cleanAnswers(rs), 'read customer reviews': () => ({ issues: [], fit: [], materialFromReviews: null, summary: '' }) }), reviewSet(rs)), cand('3256811859422872'));
    expect(out.outcome).toBe('held');
    const p = repo.products.get('ae-1005012045737624')!;
    expect(p.status).toBe('pending_review');
    expect(p.holdReasons.join(' ')).toMatch(/Material is not confirmed/);
  });

  it('rejects a fake-postage seller and blocks its other listings', async () => {
    const rs = Array.from({ length: 50 }, () => review({ skuInfo: 'Color:Black Size:M Ships From:United States' }));
    rs[0]!.text = 'Flagged for fraudulent shipping, they used fake postage';
    rs[0]!.stars = 1;
    const repo = new MemoryRepo();
    const answers = {
      ...cleanAnswers(rs),
      'read customer reviews': () => ({
        issues: [{ category: 'fake_tracking', reviewIds: [rs[0]!.id], quote: 'they used fake postage' }],
        fit: [], materialFromReviews: null, summary: '',
      }),
    };
    const c = ctx(repo, aeFetch('product_xghs_limited.json'), new FakeModel(answers), reviewSet(rs));
    const out = await processCandidate(c, cand('3256812555436716'));
    expect(out.outcome).toBe('rejected');
    const seller = [...repo.sellers.values()][0]!;
    expect(seller.blocked).toBe(true);
    // A second listing from the same store is now rejected before any AI spend.
    const model2 = new FakeModel({});
    const out2 = await processCandidate({ ...c, model: () => model2 }, { ...cand('3256812555436716'), status: 'new' });
    expect(out2.outcome).toBe('rejected');
    expect(model2.calls).toHaveLength(0);
  });

  it('marks pooled-review listings insufficient without calling the AI', async () => {
    const pooled = fx('reviews_pooled_acid_tee.json');
    const { parseReviewPage } = await import('../src/core/reviews/reviews.ts');
    const page = parseReviewPage(pooled);
    const rs: ReviewSet = { mainId: 'm', ...page.set, reviews: page.reviews, complete: true, sampled: false, fetchedAt: 0 };
    const repo = new MemoryRepo();
    const model = new FakeModel({});
    const out = await processCandidate(ctx(repo, aeFetch('product_cargo.json'), model, rs), cand('3256811859422872'));
    expect(out.outcome).toBe('insufficient_data');
    expect(model.calls).toHaveLength(0);
  });

  it('screens out dead listings', async () => {
    const repo = new MemoryRepo();
    const out = await processCandidate(ctx(repo, aeFetch('product_unavailable.json'), new FakeModel({}), reviewSet([])), cand('x'));
    expect(out.outcome).toBe('screened_out');
  });
});

describe('monitorProduct', () => {
  it('pauses a live product whose supplier cost jumps more than 15%', async () => {
    const rs = Array.from({ length: 34 }, () => review());
    const repo = new MemoryRepo();
    const product = fx('product_cargo.json');
    product.aliexpress_ds_product_get_response.result.ae_item_properties.ae_item_property.push({ attr_name: 'Material', attr_value: 'POLYESTER' });
    const c = ctx(repo, aeFetch('product_cargo.json', 'freight_paid.json', (b) => (b.get('method') === 'aliexpress.ds.product.get' ? product : undefined)), new FakeModel(cleanAnswers(rs)), reviewSet(rs));
    await processCandidate(c, cand('3256811859422872'));
    const p = repo.products.get('ae-1005012045737624')!;
    expect(p.status).toBe('live');

    const pricier = structuredClone(product);
    for (const s of pricier.aliexpress_ds_product_get_response.result.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o) s.offer_sale_price = '29.99';
    const c2: PipelineContext = { ...c, ae: new AliExpressClient({ appKey: 'k', appSecret: 's', tokens: repo.tokenStore(), fetchImpl: aeFetch('product_cargo.json', 'freight_paid.json', (b) => (b.get('method') === 'aliexpress.ds.product.get' ? pricier : undefined)), sleep: async () => {}, minIntervalMs: 0 }) };
    const res = await monitorProduct(c2, p);
    expect(res.changed).toBe(true);
    expect(repo.products.get(p.id)!.status).toBe('paused');
    expect(res.notes.join(' ')).toMatch(/cost is up/);
  });

  async function liveCargo() {
    const rs = Array.from({ length: 34 }, () => review());
    const repo = new MemoryRepo();
    const product = fx('product_cargo.json');
    product.aliexpress_ds_product_get_response.result.ae_item_properties.ae_item_property.push({ attr_name: 'Material', attr_value: 'POLYESTER' });
    const c = ctx(repo, aeFetch('product_cargo.json', 'freight_paid.json', (b) => (b.get('method') === 'aliexpress.ds.product.get' ? product : undefined)), new FakeModel(cleanAnswers(rs)), reviewSet(rs));
    await processCandidate(c, cand('3256811859422872'));
    const withProduct = (pr: unknown) => ({ ...c, ae: new AliExpressClient({ appKey: 'k', appSecret: 's', tokens: repo.tokenStore(), fetchImpl: aeFetch('product_cargo.json', 'freight_paid.json', (b) => (b.get('method') === 'aliexpress.ds.product.get' ? pr : undefined)), sleep: async () => {}, minIntervalMs: 0 }) });
    return { repo, product, withProduct, p: repo.products.get('ae-1005012045737624')! };
  }

  it('measures cost drift from the priced cost, so small rises add up', async () => {
    const { repo, product, withProduct, p } = await liveCargo();
    const priceTo = (dollars: string) => {
      const x = structuredClone(product);
      for (const s of x.aliexpress_ds_product_get_response.result.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o) s.offer_sale_price = dollars;
      return x;
    };
    // +8–13%: still live. Another rise: now 21–27% above the priced cost → paused.
    await monitorProduct(withProduct(priceTo('25.00')), p);
    expect(repo.products.get(p.id)!.status).toBe('live');
    await monitorProduct(withProduct(priceTo('28.40')), repo.products.get(p.id)!);
    expect(repo.products.get(p.id)!.status).toBe('paused');
  });

  it('pauses when any of the three store ratings drops below the minimum', async () => {
    const { repo, product, withProduct, p } = await liveCargo();
    const x = structuredClone(product);
    x.aliexpress_ds_product_get_response.result.ae_store_info.communication_rating = '4.3';
    const res = await monitorProduct(withProduct(x), p);
    expect(repo.products.get(p.id)!.status).toBe('paused');
    expect(res.notes.join(' ')).toMatch(/communication rating is 4.3/);
  });

  it('pauses a blocked seller’s live products', async () => {
    const { repo, withProduct, product, p } = await liveCargo();
    const seller = [...repo.sellers.values()][0]!;
    repo.sellers.set(seller.storeId, { ...seller, blocked: true, blockReasons: ['Never delivered'] });
    await monitorProduct(withProduct(product), p);
    expect(repo.products.get(p.id)!.status).toBe('paused');
  });

  it('screens a weak store’s other items from memory, without calling AliExpress', async () => {
    const repo = new MemoryRepo();
    const product = fx('product_cargo.json');
    product.aliexpress_ds_product_get_response.result.ae_store_info.item_as_described_rating = '3.5';
    let productCalls = 0;
    const fetchImpl = aeFetch('product_cargo.json', 'freight_paid.json', (b) => {
      if (b.get('method') === 'aliexpress.ds.product.get') {
        productCalls++;
        return product;
      }
      return undefined;
    });
    const c = ctx(repo, fetchImpl, new FakeModel({}), reviewSet([]));
    const shop = product.aliexpress_ds_product_get_response.result.ae_store_info.store_id.toString();
    const first = await processCandidate(c, { ...cand('A1'), shopId: shop });
    expect(first.outcome).toBe('screened_out');
    const second = await processCandidate(c, { ...cand('A2'), shopId: shop });
    expect(second.outcome).toBe('screened_out');
    expect(second.reasons[0]).toMatch(/As described 3.5.*store checked/);
    expect(productCalls).toBe(1);
  });
});

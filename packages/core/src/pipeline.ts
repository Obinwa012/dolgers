import { type AliExpressClient } from './aliexpress/client.ts';
import { ProductUnavailableError } from './aliexpress/parse.ts';
import { analyzeReviews } from './ai/analyze-reviews.ts';
import { checkImages } from './ai/check-images.ts';
import type { AiModels, StructuredModel } from './ai/claude.ts';
import { buildUsSizeChart, extractSellerSizeChart, type UsSizeChart } from './ai/size-chart.ts';
import type { CandidateDoc, ProductDoc, SellerDoc, SourcingDoc, SourcingSku, VettingDoc } from './firestore/model.ts';
import type { Repo } from './firestore/repo.ts';
import { writeListing } from './listing/listing.ts';
import { fetchReviews, groupBuyers } from './reviews/reviews.ts';
import type { FreightQuote, ProductSnapshot, ReviewSet, Sku } from './types.ts';
import type { VettingConfig } from './vetting/config.ts';
import { fitEvidenceFor, screen, trustCheck, vet, type VetResult } from './vetting/engine.ts';
import { ISSUE_RULES } from './vetting/issues.ts';
import { relativeChange, retailPriceCents } from './vetting/pricing.ts';

export const VETTING_VERSION = 1;
const DAY = 24 * 3600 * 1000;

export interface PipelineContext {
  ae: AliExpressClient;
  repo: Repo;
  model: StructuredModel;
  models: AiModels;
  config: VettingConfig;
  log: (msg: string) => void;
  fetchReviews?: (mainId: string) => Promise<ReviewSet>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export const US_FEEDS = [
  'AEB_ShipFromUSWithin72H_20241125',
  'AEB_US Local Items',
  'AEB_US_LocalStock_Choice_20240830',
  'AEB_US_Local_PlatformOperatedItems',
];
export const DEPARTMENTS = { men: '200000343', women: '200000345' } as const;
export type Department = keyof typeof DEPARTMENTS;

// ---------------------------------------------------------------- import

export async function importFeeds(
  ctx: PipelineContext,
  o: { department: Department; feeds?: string[]; pages: number; sort?: string },
): Promise<{ seen: number; added: number; updated: number }> {
  const categoryId = DEPARTMENTS[o.department];
  const now = (ctx.now ?? Date.now)();
  const items = new Map<string, CandidateDoc>();
  for (const feed of o.feeds ?? US_FEEDS) {
    for (let page = 1; page <= o.pages; page++) {
      const res = await ctx.ae.feedPage(feed, { categoryId, page, sort: o.sort ?? 'volumeDesc' });
      for (const it of res.items) {
        if (it.categoryId && it.categoryId !== categoryId) continue;
        const prev = items.get(it.subId);
        if (prev) {
          prev.feeds = [...new Set([...prev.feeds, feed])];
          continue;
        }
        items.set(it.subId, {
          subId: it.subId,
          mainId: null,
          feeds: [feed],
          title: it.title,
          department: o.department,
          categoryId: it.categoryId,
          subcategoryName: it.subcategoryName,
          shopId: it.shopId,
          recentSales: it.recentSales,
          feedPriceCents: it.feedPriceCents,
          status: 'new',
          reasons: [],
          nextCheckAt: null,
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      ctx.log(`${feed} page ${page}: ${res.items.length} items`);
      if (res.finished) break;
    }
  }
  const r = await ctx.repo.upsertCandidates([...items.values()]);
  return { seen: items.size, ...r };
}

// ---------------------------------------------------------------- vet one

export type Outcome = 'published' | 'held' | 'insufficient_data' | 'rejected' | 'screened_out' | 'error';

export async function processCandidate(ctx: PipelineContext, cand: CandidateDoc): Promise<{ outcome: Outcome; reasons: string[]; productId?: string }> {
  const now = (ctx.now ?? Date.now)();
  const { config } = ctx;
  const stop = async (outcome: Outcome, status: CandidateDoc['status'], reasons: string[], recheckDays: number | null, extra: Partial<CandidateDoc> = {}) => {
    await ctx.repo.updateCandidate(cand.subId, {
      status,
      reasons,
      nextCheckAt: recheckDays === null ? null : now + recheckDays * DAY,
      attempts: cand.attempts + 1,
      ...extra,
    });
    return { outcome, reasons };
  };

  // 1. Live listing data and one shipping quote.
  let product: ProductSnapshot;
  try {
    product = await ctx.ae.product(cand.subId);
  } catch (e) {
    if (e instanceof ProductUnavailableError) return stop('screened_out', 'screened_out', [e.reason], 60);
    throw e;
  }
  const productId = `ae-${product.mainId}`;
  const firstUs = product.skus.find((s) => s.shipsFrom === 'United States' && (s.stock ?? 0) > 0);
  const freight: FreightQuote[] = firstUs ? [await ctx.ae.freight(product.mainId, firstUs.skuId)] : [];
  const sc = screen(product, freight, config);
  const scReasons = sc.checks.filter((c) => !c.pass && c.level !== 'info').map((c) => c.detail);
  if (sc.checks.some((c) => !c.pass && c.level === 'reject')) {
    return stop('screened_out', 'screened_out', scReasons, 90, { mainId: product.mainId });
  }
  if (!sc.pass) return stop('insufficient_data', 'insufficient_data', scReasons, config.recheckAfterDays, { mainId: product.mainId });

  // 2. Seller history.
  const seller = await sellerRecord(ctx, product, sc.shipping);
  if (seller.blocked) return stop('rejected', 'rejected', [`Seller blocked: ${seller.blockReasons.join('; ')}`], null, { mainId: product.mainId });

  // 3. Reviews and the trust test, before any AI spend.
  let reviews: ReviewSet;
  try {
    reviews = await (ctx.fetchReviews ?? ((id) => fetchReviews(id)))(product.mainId);
  } catch (e) {
    return stop('insufficient_data', 'insufficient_data', [`Reviews unavailable: ${(e as Error).message}`], 7, { mainId: product.mainId });
  }
  const trust = trustCheck(reviews, config);
  if (!trust.pass) {
    return stop('insufficient_data', 'insufficient_data', trust.checks.filter((c) => !c.pass).map((c) => c.detail), config.recheckAfterDays, { mainId: product.mainId });
  }

  // Buyer count is known before any AI call: don't pay to analyse what can't qualify.
  const nBuyers = groupBuyers(reviews.reviews).length;
  const r0 = product.store.ratings;
  const strong = [r0.asDescribed, r0.communication, r0.shipping].every((x) => x !== null && x >= config.strongSellerRating);
  if (nBuyers < config.probationMinBuyers || (nBuyers < config.importMinBuyers && !strong)) {
    return stop('insufficient_data', 'insufficient_data', [`${nBuyers} unique buyers${nBuyers >= config.probationMinBuyers ? ' and the seller is not strong enough for probation' : ''}`], config.recheckAfterDays, { mainId: product.mainId });
  }

  // 4. AI evidence: images (gallery and variant photos, where print designs usually are) and reviews.
  const variantImages = [...new Set(product.skus.filter((k) => k.shipsFrom === 'United States').map((k) => k.image).filter((u): u is string => !!u))];
  const img = await checkImages(ctx.model, ctx.models, [...product.images.slice(0, 4), ...variantImages.slice(0, 4)], product.title, ctx.fetchImpl);
  const listingMaterial = product.attributes.Material ?? null;
  const analysis = await analyzeReviews(ctx.model, ctx.models, reviews.reviews, { title: product.title, material: listingMaterial });
  const result = vet({
    product,
    freight,
    reviews,
    analysis,
    imageCheck: img.checked ? img : null,
    seller: { storeId: seller.storeId, name: seller.name, blocked: false, blockReasons: [], linkedTo: seller.linkedTo },
    config,
  });
  await recordSeller(ctx, seller, result, now);

  const vetting: VettingDoc = {
    productId,
    aeMainId: product.mainId,
    result,
    reviewSummary: analysis.summary,
    materialFromReviews: analysis.materialFromReviews,
    imageCheck: img,
    sellerSizeChart: null,
    usSizeChartReasoning: null,
    listingProblems: [],
    evidence: [],
    claims: [],
    models: ctx.models,
    version: VETTING_VERSION,
    vettedAt: now,
  };

  if (result.decision === 'reject') {
    await ctx.repo.saveVetting(vetting);
    return stop('rejected', 'rejected', result.reasons, null, { mainId: product.mainId });
  }
  if (result.decision === 'insufficient_data') {
    await ctx.repo.saveVetting(vetting);
    return stop('insufficient_data', 'insufficient_data', result.reasons, config.recheckAfterDays, { mainId: product.mainId });
  }

  // 5. Build the US listing.
  const holdReasons: string[] = [];
  if (result.decision !== 'import') holdReasons.push(...result.reasons.filter((r) => r.startsWith('Needs review')), `Decision: ${result.decision}`);
  const material = resolveMaterial(listingMaterial, verifiedReviewMaterial(analysis.materialFromReviews, reviews), holdReasons);
  const usSkus = product.skus.filter((s) => result.usSkuIds.includes(s.skuId));
  const department = cand.department;
  const kind = garmentKind(cand.subcategoryName, product.title);

  const sellerChart = await extractSellerSizeChart(ctx.model, ctx.models, product.descriptionImages, product.attributes.size_info, ctx.fetchImpl);
  let usChart: UsSizeChart | null = null;
  const sizes = [...new Set(usSkus.map((s) => s.props.Size).filter((x): x is string => !!x))];
  if (sizes.length) {
    usChart = await buildUsSizeChart(ctx.model, ctx.models, {
      title: product.title,
      department,
      kind,
      sizesSold: sizes,
      seller: sellerChart,
      usFit: fitEvidenceFor(reviews.reviews, analysis, 'US'),
    });
    if (!sellerChart.found) holdReasons.push('No seller size chart found; size guide is based on reviews and US standards only');
  }

  const shipping = await shippingBySku(ctx, product.mainId, usSkus, freight);
  const noCost = usSkus.filter((k) => k.priceCents === null || k.priceCents <= 0);
  if (noCost.length) holdReasons.push(`Supplier price missing for ${noCost.length} variant(s)`);
  const noShip = usSkus.filter((k) => !shipping.has(k.skuId));
  if (noShip.length) holdReasons.push(`No US shipping quote for ${noShip.length} variant(s)`);
  const { draft, evidence, problems } = await writeListing(
    ctx.model,
    ctx.models,
    {
      product,
      skus: usSkus,
      department,
      material,
      sizeChart: usChart,
      listingFixes: result.listingFixes,
      delivery: sc.shipping ? { minDays: sc.shipping.minDays, maxDays: sc.shipping.maxDays } : null,
      reviewSummary: analysis.summary,
    },
    config,
    ctx.fetchImpl,
  );
  holdReasons.push(...problems.map((p) => `Listing: ${p}`));

  const names = new Map(draft.variants.map((v) => [v.skuId, v]));
  const sourcingSkus: SourcingSku[] = usSkus.map((s) => {
    const shippingCents = shipping.get(s.skuId) ?? Math.max(0, ...shipping.values(), sc.shipping?.feeCents ?? 0);
    const costCents = s.priceCents ?? 0;
    const landedCents = costCents + shippingCents;
    return { aeSkuId: s.skuId, props: s.props, costCents, shippingCents, landedCents, pricedLandedCents: landedCents, stock: s.stock ?? 0 };
  });
  const variants = sourcingSkus.map((s) => ({
    id: s.aeSkuId,
    color: names.get(s.aeSkuId)?.color ?? s.props.Color ?? '',
    size: names.get(s.aeSkuId)?.size ?? s.props.Size ?? '',
    priceCents: retailPriceCents(s.landedCents, config.pricing),
    inStock: s.stock > 0,
  }));
  const prices = variants.map((v) => v.priceCents);
  const existing = await ctx.repo.getProduct(productId);
  if (existing?.status === 'retired') holdReasons.push('Previously retired; not republishing automatically');
  const status: ProductDoc['status'] =
    existing?.status === 'retired' ? 'retired' : result.decision === 'import' && holdReasons.length === 0 ? 'live' : 'pending_review';

  const productDoc: ProductDoc = {
    id: productId,
    handle: draft.handle,
    status,
    holdReasons,
    decision: result.decision,
    department,
    category: draft.storeCategory,
    title: draft.title,
    bullets: draft.bullets,
    description: draft.description,
    faq: draft.faq,
    seo: { ...draft.seo, keywordStatus: 'guess' },
    images: product.images.map((url, i) => ({ url, alt: draft.imageAlts.find((a) => a.index === i)?.alt ?? draft.title })),
    variants,
    colors: [...new Set(variants.map((v) => v.color))],
    sizes: [...new Set(variants.map((v) => v.size))],
    priceFromCents: Math.min(...prices),
    priceToCents: Math.max(...prices),
    freeShipping: config.pricing.freeShipping,
    delivery: { minDays: sc.shipping?.minDays ?? null, maxDays: sc.shipping?.maxDays ?? null },
    material,
    origin: 'Imported',
    sizeChart: usChart ? { fitType: usChart.fitType, rows: usChart.rows, fitNotes: usChart.fitNotes } : null,
    probation: existing?.probation ?? { active: true, orders: 0, defects: 0, maxDefects: result.decision === 'import' ? 2 : 1, windowOrders: result.decision === 'import' ? 40 : 20 },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    publishedAt: status === 'live' ? existing?.publishedAt ?? now : existing?.publishedAt ?? null,
  };
  const sourcing: SourcingDoc = {
    productId,
    aeSubId: product.subId,
    aeMainId: product.mainId,
    storeId: product.store.storeId,
    storeName: product.store.name,
    feeds: cand.feeds,
    skus: sourcingSkus,
    shipping: sc.shipping,
    supplierUrl: `https://www.aliexpress.com/item/${product.mainId}.html`,
    lastCheckedAt: now,
    lastCheck: { ok: true, notes: ['Imported'] },
    updatedAt: now,
  };
  vetting.sellerSizeChart = sellerChart;
  vetting.usSizeChartReasoning = usChart?.reasoning ?? null;
  vetting.listingProblems = problems;
  vetting.evidence = evidence;
  vetting.claims = draft.claims;

  await ctx.repo.saveProduct(productDoc, sourcing, vetting);
  const outcome: Outcome = status === 'live' ? 'published' : 'held';
  await ctx.repo.updateCandidate(cand.subId, { status: outcome === 'published' ? 'published' : 'held', reasons: holdReasons, mainId: product.mainId, nextCheckAt: null, attempts: cand.attempts + 1 });
  return { outcome, reasons: status === 'live' ? result.reasons : holdReasons, productId };
}

/** Shipping per variant: one quote per distinct size (heavier sizes can cost more). */
async function shippingBySku(ctx: PipelineContext, mainId: string, skus: Sku[], known: FreightQuote[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const bySize = new Map<string, Sku[]>();
  for (const s of skus) {
    const k = s.props.Size ?? 'one';
    bySize.set(k, [...(bySize.get(k) ?? []), s]);
  }
  // Quote up to 8 sizes; any further sizes take the highest fee seen (never the lowest).
  for (const [, group] of [...bySize].slice(0, 8)) {
    const rep = group[0]!;
    const q = known.find((k) => k.skuId === rep.skuId) ?? (await ctx.ae.freight(mainId, rep.skuId));
    const us = q.options.filter((o) => o.shipFrom === 'US');
    if (!us.length) continue;
    const fee = Math.min(...us.map((o) => o.feeCents));
    group.forEach((s) => out.set(s.skuId, fee));
  }
  if (out.size) {
    const worst = Math.max(...out.values());
    for (const [, group] of [...bySize].slice(8)) group.forEach((s) => out.set(s.skuId, worst));
  }
  return out;
}

/** Trust a buyer-reported material only if at least two written reviews actually name it. */
function verifiedReviewMaterial(material: string | null, reviews: ReviewSet): string | null {
  if (!material) return null;
  const word = material.toLowerCase().replace(/^100%\s*/, '').split(/[\s,/]+/)[0] ?? '';
  if (word.length < 3) return null;
  const hits = reviews.reviews.filter((r) => `${r.text} ${r.additionalText}`.toLowerCase().includes(word)).length;
  return hits >= 2 ? material : null;
}

function resolveMaterial(fromListing: string | null, fromReviews: string | null, hold: string[]): string | null {
  const l = fromListing?.trim() || null;
  const r = fromReviews?.trim() || null;
  if (l && r && !l.toLowerCase().includes(r.toLowerCase()) && !r.toLowerCase().includes(l.toLowerCase())) {
    hold.push(`Material conflict: listing says "${l}", buyers say "${r}"`);
    return null;
  }
  return l ? titleCase(l) : r ? titleCase(r) : null;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function garmentKind(subcategory: string | null, title: string): 'tops' | 'bottoms' {
  return /pant|jean|denim|short|skirt|trouser|jogger|legging|capri/i.test(`${subcategory ?? ''} ${title}`) &&
    !/set|suit|dress|romper|jumpsuit/i.test(subcategory ?? '')
    ? 'bottoms'
    : 'tops';
}

// ---------------------------------------------------------------- sellers

interface SellerState extends SellerDoc {
  linkedTo: string[];
}

function fingerprint(product: ProductSnapshot, shipping: ReturnType<typeof screen>['shipping']): string | null {
  if (!shipping) return null;
  const cheapest = Math.min(...product.skus.map((s) => s.priceCents ?? Infinity));
  const band = cheapest < 500 ? 'under5' : cheapest < 1500 ? 'under15' : 'over15';
  return [shipping.carrier, shipping.feeCents, `${shipping.minDays}-${shipping.maxDays}`, band].join('|');
}

async function sellerRecord(ctx: PipelineContext, product: ProductSnapshot, shipping: ReturnType<typeof screen>['shipping']): Promise<SellerState> {
  const existing = await ctx.repo.getSeller(product.store.storeId);
  const fp = fingerprint(product, shipping);
  const blocked = await ctx.repo.blockedSellers();
  const storeNum = Number(product.store.storeId);
  const linkedTo = blocked
    .filter((b) => b.storeId !== product.store.storeId && b.fingerprint && b.fingerprint === fp && Math.abs(Number(b.storeId) - storeNum) < 50_000)
    .map((b) => `${b.name} (${b.storeId})`);
  return {
    storeId: product.store.storeId,
    name: product.store.name,
    ratings: product.store.ratings,
    productsVetted: existing?.productsVetted ?? 0,
    productsRejected: existing?.productsRejected ?? 0,
    strikes: existing?.strikes ?? {},
    blocked: existing?.blocked ?? false,
    blockReasons: existing?.blockReasons ?? [],
    fingerprint: fp,
    updatedAt: Date.now(),
    linkedTo,
  };
}

async function recordSeller(ctx: PipelineContext, s: SellerState, result: VetResult, now: number) {
  const strikes = { ...s.strikes };
  for (const c of result.sellerStrikes) strikes[c] = (strikes[c] ?? 0) + 1;
  const blockReasons = [...s.blockReasons];
  for (const c of result.sellerStrikes) {
    const label = ISSUE_RULES[c].label;
    if (!blockReasons.includes(label)) blockReasons.push(label);
  }
  const { linkedTo: _linked, ...doc } = s;
  const nowBlocked = !s.blocked && result.sellerStrikes.length > 0;
  if (nowBlocked) {
    for (const id of await ctx.repo.productIdsByStore(s.storeId)) {
      const p = await ctx.repo.getProduct(id);
      if (p && (p.status === 'live' || p.status === 'pending_review')) {
        await ctx.repo.updateProduct(id, { status: 'paused', holdReasons: [`Seller blocked: ${blockReasons.join('; ')}`] });
        ctx.log(`Paused ${id}: its seller is now blocked`);
      }
    }
  }
  await ctx.repo.saveSeller({
    ...doc,
    productsVetted: s.productsVetted + 1,
    productsRejected: s.productsRejected + (result.decision === 'reject' ? 1 : 0),
    strikes,
    blocked: s.blocked || result.sellerStrikes.length > 0,
    blockReasons,
    updatedAt: now,
  });
}

// ---------------------------------------------------------------- monitor

export async function monitorProduct(ctx: PipelineContext, p: ProductDoc): Promise<{ changed: boolean; notes: string[] }> {
  const now = (ctx.now ?? Date.now)();
  const src = await ctx.repo.getSourcing(p.id);
  if (!src) return { changed: false, notes: ['No sourcing record'] };
  const notes: string[] = [];
  const pauseWith = async (reasons: string[]) => {
    await ctx.repo.updateProduct(p.id, { status: 'paused', holdReasons: reasons });
    await ctx.repo.updateSourcing(p.id, { lastCheckedAt: now, lastCheck: { ok: false, notes: reasons } });
    return { changed: p.status !== 'paused', notes: reasons };
  };

  const seller = await ctx.repo.getSeller(src.storeId);
  if (seller?.blocked) return pauseWith([`Seller blocked: ${seller.blockReasons.join('; ')}`]);

  let snap: ProductSnapshot;
  try {
    snap = await ctx.ae.product(src.aeSubId);
  } catch (e) {
    if (e instanceof ProductUnavailableError) return pauseWith([`Supplier listing unavailable: ${e.reason}`]);
    throw e;
  }
  let pause = false;
  if (snap.status !== 'onSelling') {
    notes.push(`Supplier listing status is ${snap.status || 'unknown'}`);
    pause = true;
  }
  const r = snap.store.ratings;
  for (const [name, v] of [['as described', r.asDescribed], ['communication', r.communication], ['shipping', r.shipping]] as const) {
    if (v === null || v < ctx.config.minStoreRating) {
      notes.push(`Store ${name} rating is ${v ?? 'missing'} (minimum ${ctx.config.minStoreRating})`);
      pause = true;
    }
  }

  const byId = new Map(snap.skus.map((s) => [s.skuId, s]));
  const liveSkus = src.skus.map((s) => byId.get(s.aeSkuId)).filter((s): s is Sku => !!s && s.shipsFrom === 'United States');
  const shipping = await shippingBySku(ctx, src.aeMainId, liveSkus, []);
  const skus = src.skus.map((s) => {
    const live = byId.get(s.aeSkuId);
    if (!live || live.shipsFrom !== 'United States') {
      notes.push(`Variant ${s.aeSkuId} no longer ships from the US`);
      return { ...s, stock: 0 };
    }
    const ship = shipping.get(s.aeSkuId);
    if (ship === undefined) {
      notes.push(`Variant ${s.aeSkuId} has no US shipping quote`);
      return { ...s, stock: 0 };
    }
    const cost = live.priceCents ?? null;
    if (cost === null) {
      notes.push(`Variant ${s.aeSkuId} has no supplier price`);
      return { ...s, stock: 0 };
    }
    const landed = cost + ship;
    // Compare with the cost the retail price was set from, so small weekly rises can't add up unnoticed.
    const base = s.pricedLandedCents ?? s.landedCents;
    const change = relativeChange(base, landed);
    if (landed > base && change > ctx.config.pricing.maxCostChangeBeforePause) {
      notes.push(`Variant ${s.aeSkuId} cost is up ${(change * 100).toFixed(0)}% since it was priced ($${(base / 100).toFixed(2)} → $${(landed / 100).toFixed(2)}); reprice before selling`);
      pause = true;
    }
    return { ...s, costCents: cost, shippingCents: ship, landedCents: landed, stock: live.stock ?? 0 };
  });
  const inStock = new Map(skus.map((s) => [s.aeSkuId, s.stock > 0]));
  const variants = p.variants.map((v) => ({ ...v, inStock: inStock.get(v.id) ?? false }));
  if (!variants.some((v) => v.inStock)) {
    notes.push('No variant is in stock with US shipping');
    pause = true;
  }

  await ctx.repo.updateSourcing(p.id, { skus, lastCheckedAt: now, lastCheck: { ok: !pause, notes } });
  const patch: Partial<ProductDoc> = { variants };
  if (pause && p.status === 'live') {
    patch.status = 'paused';
    patch.holdReasons = notes;
  }
  await ctx.repo.updateProduct(p.id, patch);
  return { changed: (pause && p.status === 'live') || variants.some((v, i) => v.inStock !== p.variants[i]?.inStock), notes };
}

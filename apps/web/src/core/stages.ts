/**
 * Vetting one candidate, as a sequence of short stages. Every stage saves its result to
 * work/{subId}, so each server request stays short and a timeout or a closed browser tab resumes
 * where it stopped. The decisions themselves are made by vetting/engine.ts.
 */
import type { AliExpressClient } from './aliexpress/client.ts';
import { ProductUnavailableError } from './aliexpress/parse.ts';
import { ANALYSIS_CHUNK, analyzeReviewChunk, mergeAnalyses, textReviews } from './ai/analyze-reviews.ts';
import { checkImages } from './ai/check-images.ts';
import type { AiModels, StructuredModel } from './ai/claude.ts';
import { compareBuyerPhotos, pickBuyerPhotos } from './ai/compare-photos.ts';
import { buildSizeGuide, extractSellerSizeChart, normSize } from './ai/size-chart.ts';
import type { CandidateDoc, ProductDoc, ProductFlag, SellerDoc, SourcingDoc, SourcingSku, VettingDoc, WorkState } from './firestore/model.ts';
import { MAX_ATTEMPTS, type Repo } from './firestore/repo.ts';
import { writeListing } from './listing/listing.ts';
import { assembleReviews, fetchReviewPage, groupBuyers } from './reviews/reviews.ts';
import type { FreightQuote, ProductSnapshot, Review, ReviewSet, Sku } from './types.ts';
import type { VettingConfig } from './vetting/config.ts';
import { bestCase, fitEvidenceFor, screen, trustCheck, vet, type VetResult } from './vetting/engine.ts';
import { ISSUE_RULES } from './vetting/issues.ts';
import { profitCents, retailPriceCents } from './vetting/pricing.ts';

export const VETTING_VERSION = 3;
const DAY = 24 * 3600 * 1000;
/** Review pages fetched per listing: 25 pages = 500 most relevant reviews. */
export const MAX_REVIEW_PAGES = 25;
/** How long one request keeps working before it saves and returns. */
const STEP_BUDGET_MS = 25_000;
/** Stages that call Claude: one per request, so a slow model call can't stack with another. */
const AI_STAGES = new Set(['images', 'analysis', 'photos', 'seller_chart', 'us_chart', 'listing']);

export interface PipelineContext {
  ae: AliExpressClient;
  repo: Repo;
  /** Created lazily: imports and monitoring never need it. */
  model: () => StructuredModel;
  models: AiModels;
  config: VettingConfig;
  log: (msg: string) => void;
  fetchImpl?: typeof fetch;
  fetchReviewPage?: typeof fetchReviewPage;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export const US_FEEDS = [
  'AEB_ShipFromUSWithin72H_20241125',
  'AEB_US Local Items',
  'AEB_US_LocalStock_Choice_20240830',
  'AEB_US_Local_PlatformOperatedItems',
];
/** DOLGERS sells men's clothing only. */
export const MENS_CLOTHING = '200000343';

/** ready = passed every check and waits for your review; held = waits for you with flags. */
export type Outcome = 'ready' | 'held' | 'insufficient_data' | 'rejected' | 'screened_out' | 'error';

export interface StepResult {
  work: WorkState | null;
  finished: boolean;
  outcome?: Outcome;
  reasons?: string[];
  productId?: string;
}

// ---------------------------------------------------------------- import

/** Imports one feed page of men's clothing into the candidate queue. */
export async function importFeedPage(ctx: PipelineContext, feed: string, page: number) {
  const now = (ctx.now ?? Date.now)();
  const res = await ctx.ae.feedPage(feed, { categoryId: MENS_CLOTHING, page, sort: 'volumeDesc' });
  const mens = res.items.filter((it) => !it.categoryId || it.categoryId === MENS_CLOTHING);
  // Too few sales to have the reviews vetting needs: don't fill the queue with them.
  const items: CandidateDoc[] = mens
    .filter((it) => it.recentSales >= ctx.config.importMinSales)
    .map((it) => ({
      subId: it.subId,
      mainId: null,
      feeds: [feed],
      title: it.title,
      department: 'men',
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
    }));
  const r = await ctx.repo.upsertCandidates(items);
  return { ...r, seen: mens.length, kept: items.length, tooFewSales: mens.length - items.length, finished: res.finished, total: res.total };
}

// ---------------------------------------------------------------- vetting stages

export function newWork(cand: CandidateDoc, now: number): WorkState {
  return { subId: cand.subId, stage: 'fetch', attempts: 0, candidate: cand, startedAt: now, updatedAt: now };
}

/** Runs stages until one calls Claude, the budget runs out, or the candidate is finished. */
export async function advanceWork(ctx: PipelineContext, work: WorkState): Promise<StepResult> {
  const clock = ctx.now ?? Date.now;
  const started = clock();
  let w = work;
  for (;;) {
    const stage = w.stage;
    const r = await runStage(ctx, w);
    if (r.finished) return r;
    w = r.work!;
    w.updatedAt = clock();
    w.attempts = 0;
    delete w.lastError;
    await ctx.repo.saveWork(w);
    if (AI_STAGES.has(stage) || clock() - started > STEP_BUDGET_MS || stage === w.stage) {
      return { work: w, finished: false };
    }
    // Start a Claude call only in a fresh request, so API work and a model call never share one.
    if (AI_STAGES.has(w.stage) && clock() - started > 2_000) return { work: w, finished: false };
  }
}

async function runStage(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  switch (w.stage) {
    case 'fetch': return stageFetch(ctx, w);
    case 'reviews': return stageReviews(ctx, w);
    case 'images': return stageImages(ctx, w);
    case 'analysis': return stageAnalysis(ctx, w);
    case 'photos': return stagePhotos(ctx, w);
    case 'decide': return stageDecide(ctx, w);
    case 'seller_chart': return stageSellerChart(ctx, w);
    case 'us_chart': return stageUsChart(ctx, w);
    case 'shipping': return stageShipping(ctx, w);
    case 'listing': return stageListing(ctx, w);
    case 'save': return stageSave(ctx, w);
    default: return { work: w, finished: true, outcome: 'error', reasons: [`Unknown stage ${w.stage}`] };
  }
}

/** Ends a candidate: records where it stopped and when to look again, and clears its work state. */
async function finish(
  ctx: PipelineContext,
  w: WorkState,
  outcome: Outcome,
  status: CandidateDoc['status'],
  reasons: string[],
  recheckDays: number | null,
  productId?: string,
): Promise<StepResult> {
  const now = (ctx.now ?? Date.now)();
  const attempts = w.candidate.attempts + 1;
  const mainId = w.product?.mainId ?? w.candidate.mainId;
  await ctx.repo.updateCandidate(w.subId, {
    status,
    reasons,
    mainId,
    // After MAX_ATTEMPTS looks an item is left alone, so it can't crowd out other rechecks.
    nextCheckAt: recheckDays === null || attempts >= MAX_ATTEMPTS ? null : now + recheckDays * DAY,
    attempts,
  });
  // A re-vet of a listed product that no longer passes takes it out of the catalog.
  if (mainId && (outcome === 'rejected' || outcome === 'screened_out' || outcome === 'insufficient_data')) {
    const existing = await ctx.repo.getProduct(`ae-${mainId}`);
    if (existing && (existing.status === 'live' || existing.status === 'pending_review')) {
      await ctx.repo.updateProduct(existing.id, { status: 'paused', holdReasons: [`Re-vet: ${reasons[0] ?? outcome}`], review: CLEARED_CHECKS, updatedAt: now });
    }
  }
  await ctx.repo.deleteWork(w.subId);
  return { work: null, finished: true, outcome, reasons, productId };
}

/** Called when a stage keeps failing: give up on this candidate for a day. */
export async function failWork(ctx: PipelineContext, w: WorkState, message: string): Promise<StepResult> {
  return finish(ctx, w, 'error', 'error', [`Failed at "${w.stage}": ${message}`], 1);
}

/** Store ratings read this recently are trusted without asking AliExpress again. */
const SELLER_MEMORY_DAYS = 14;

async function stageFetch(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const { config } = ctx;
  const now = (ctx.now ?? Date.now)();
  // Many items come from the same few stores. A store already known to be blocked, or below the
  // rating bar, fails every item the same way, so skip the API calls for the rest of its items.
  const shopId = w.candidate.shopId;
  const known = shopId ? await ctx.repo.getSeller(shopId) : null;
  if (known?.blocked) return finish(ctx, w, 'rejected', 'rejected', [`Seller blocked: ${known.blockReasons.join('; ')}`], null);
  if (known?.ratingsCheckedAt && now - known.ratingsCheckedAt < SELLER_MEMORY_DAYS * DAY && !ratingsPass(known.ratings, config)) {
    return finish(ctx, w, 'screened_out', 'screened_out', [`${ratingsText(known.ratings, config)}, store checked ${new Date(known.ratingsCheckedAt).toISOString().slice(0, 10)}`], 90);
  }
  let product: ProductSnapshot;
  try {
    product = await ctx.ae.product(w.subId);
  } catch (e) {
    if (e instanceof ProductUnavailableError) return finish(ctx, w, 'screened_out', 'screened_out', [e.reason], 60);
    throw e;
  }
  const firstUs = product.skus.find((s) => s.shipsFrom === 'United States' && (s.stock ?? 0) > 0);
  const freight: FreightQuote[] = firstUs ? [await ctx.ae.freight(product.mainId, firstUs.skuId)] : [];
  w.product = product;
  w.freight = freight;
  await rememberStore(ctx, product, now);
  const sc = screen(product, freight, config);
  const reasons = sc.checks.filter((c) => !c.pass && c.level !== 'info').map((c) => c.detail);
  if (sc.checks.some((c) => !c.pass && c.level === 'reject')) return finish(ctx, w, 'screened_out', 'screened_out', reasons, 90);
  if (!sc.pass) return finish(ctx, w, 'insufficient_data', 'insufficient_data', reasons, config.recheckAfterDays);

  const seller = await ctx.repo.getSeller(product.store.storeId);
  if (seller?.blocked) return finish(ctx, w, 'rejected', 'rejected', [`Seller blocked: ${seller.blockReasons.join('; ')}`], null);
  w.stage = 'reviews';
  w.reviewsNextPage = 1;
  return { work: w, finished: false };
}

async function stageReviews(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const clock = ctx.now ?? Date.now;
  const started = clock();
  const getPage = ctx.fetchReviewPage ?? fetchReviewPage;
  const mainId = w.product!.mainId;
  while (clock() - started < 15_000) {
    const page = w.reviewsNextPage ?? 1;
    const last = w.reviewsFirst ? Math.min(w.reviewsFirst.totalPages, MAX_REVIEW_PAGES) : 1;
    if (w.reviewsFirst && page > last) break;
    try {
      const res = await getPage(mainId, page, { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep });
      if (page === 1) w.reviewsFirst = { set: res.set, totalPages: res.totalPages, writtenTotal: res.writtenTotal };
      await ctx.repo.appendWorkReviews(w.subId, res.reviews);
      w.reviewsNextPage = page + 1;
    } catch (e) {
      if (page === 1) {
        return finish(ctx, w, 'insufficient_data', 'insufficient_data', [`Reviews unavailable: ${(e as Error).message}`], 7);
      }
      w.reviewsFailed = true;
      break;
    }
    if (page >= (w.reviewsFirst ? Math.min(w.reviewsFirst.totalPages, MAX_REVIEW_PAGES) : 1)) break;
    await (ctx.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(1200);
  }
  const last = Math.min(w.reviewsFirst!.totalPages, MAX_REVIEW_PAGES);
  if (!w.reviewsFailed && (w.reviewsNextPage ?? 1) <= last) return { work: w, finished: false }; // more pages next request

  const reviews = await reviewSet(ctx, w);
  const trust = trustCheck(reviews, ctx.config);
  if (!trust.pass) {
    return finish(ctx, w, 'insufficient_data', 'insufficient_data', trust.checks.filter((c) => !c.pass).map((c) => c.detail), ctx.config.recheckAfterDays);
  }
  // Buyers, written reviews and low ratings are known before any AI call: don't pay Claude to
  // analyse a product that can't pass even if every review turns out to be clean.
  const best = bestCase(reviews.reviews, w.product!, ctx.config);
  if (!best.canPass) return finish(ctx, w, 'insufficient_data', 'insufficient_data', [best.reason], ctx.config.recheckAfterDays);
  w.stage = 'images';
  return { work: w, finished: false };
}

async function reviewSet(ctx: PipelineContext, w: WorkState): Promise<ReviewSet> {
  const reviews = await ctx.repo.getWorkReviews(w.subId);
  const first = { ...w.reviewsFirst!, reviews: [] };
  return assembleReviews(w.product!.mainId, first, reviews, { failed: !!w.reviewsFailed, maxPages: MAX_REVIEW_PAGES });
}

async function stageImages(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const p = w.product!;
  // Vetting saved under older, looser rules may resume here: check again before paying for AI.
  const best = bestCase(await ctx.repo.getWorkReviews(w.subId), p, ctx.config);
  if (!best.canPass) return finish(ctx, w, 'insufficient_data', 'insufficient_data', [best.reason], ctx.config.recheckAfterDays);
  // Gallery and variant photos: print designs usually show on the variant images.
  const variantImages = [...new Set(p.skus.filter((k) => k.shipsFrom === 'United States').map((k) => k.image).filter((u): u is string => !!u))];
  w.imageCheck = await checkImages(ctx.model(), ctx.models, [...p.images.slice(0, 4), ...variantImages.slice(0, 4)], p.title, ctx.fetchImpl);
  w.stage = 'analysis';
  w.analysisChunk = 0;
  w.analysisParts = [];
  return { work: w, finished: false };
}

async function stageAnalysis(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const reviews = await ctx.repo.getWorkReviews(w.subId);
  const withText = textReviews(reviews);
  const i = w.analysisChunk ?? 0;
  if (i * ANALYSIS_CHUNK < withText.length) {
    const part = await analyzeReviewChunk(ctx.model(), ctx.models, withText.slice(i * ANALYSIS_CHUNK, (i + 1) * ANALYSIS_CHUNK), {
      title: w.product!.title,
      material: w.product!.attributes.Material ?? null,
      now: (ctx.now ?? Date.now)(),
    });
    w.analysisParts = [...(w.analysisParts ?? []), part];
    w.analysisChunk = i + 1;
    if (w.analysisChunk * ANALYSIS_CHUNK < withText.length) return { work: w, finished: false };
  }
  w.analysis = mergeAnalyses(w.analysisParts ?? [], reviews);
  w.analysisParts = [];
  w.stage = 'photos';
  return { work: w, finished: false };
}

/** Gallery photos next to what buyers say arrived. */
async function stagePhotos(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const reviews = await ctx.repo.getWorkReviews(w.subId);
  const picked = pickBuyerPhotos(reviews, (ctx.now ?? Date.now)());
  w.photoCheck = picked.length
    ? await compareBuyerPhotos(ctx.model(), ctx.models, w.product!.images, picked, w.product!.title, ctx.fetchImpl)
    : { compared: 0, mismatches: [], quality: 'No buyer photos' };
  w.stage = 'decide';
  return { work: w, finished: false };
}

async function stageDecide(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const now = (ctx.now ?? Date.now)();
  const product = w.product!;
  const reviews = await reviewSet(ctx, w);
  const sc = screen(product, w.freight ?? [], ctx.config);
  const seller = await sellerState(ctx, product, sc.shipping);
  const result = vet({
    product,
    freight: w.freight ?? [],
    reviews,
    analysis: w.analysis ?? null,
    imageCheck: w.imageCheck?.checked ? w.imageCheck : null,
    photoCheck: w.photoCheck ?? null,
    seller: { storeId: seller.storeId, name: seller.name, blocked: false, blockReasons: [], linkedTo: seller.linkedTo },
    config: ctx.config,
    now,
  });
  await recordSeller(ctx, seller, result, now);
  w.result = result;

  if (result.decision === 'reject' || result.decision === 'insufficient_data') {
    await ctx.repo.saveVetting(await vettingDoc(ctx, w, now));
    return result.decision === 'reject'
      ? finish(ctx, w, 'rejected', 'rejected', result.reasons, null)
      : finish(ctx, w, 'insufficient_data', 'insufficient_data', result.reasons, ctx.config.recheckAfterDays);
  }
  const hold: string[] = [...(result.flags ?? [])];
  if (result.decision === 'probation') hold.push('Probation: fewer buyers than a full import; take a slower look');
  w.material = resolveMaterial(product.attributes.Material ?? null, verifiedReviewMaterial(w.analysis?.materialFromReviews ?? null, reviews), hold);
  w.holdReasons = hold;
  w.stage = 'seller_chart';
  return { work: w, finished: false };
}

async function stageSellerChart(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const p = w.product!;
  w.sellerChart = await extractSellerSizeChart(ctx.model(), ctx.models, p.descriptionImages, p.attributes.size_info, ctx.fetchImpl);
  if (!w.sellerChart.found) {
    w.holdReasons = [...(w.holdReasons ?? []), 'No supplier size chart found, so the listing has no size guide'];
  } else if (w.sellerChart.measurementType === 'unknown') {
    w.holdReasons = [...(w.holdReasons ?? []), "The supplier's chart doesn't say whether it measures the garment or the body"];
  }
  w.stage = sizesSold(w).length && w.sellerChart.found ? 'us_chart' : 'shipping';
  if (w.stage === 'shipping') w.usChart = null;
  return { work: w, finished: false };
}

async function stageUsChart(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const p = w.product!;
  const reviews = await ctx.repo.getWorkReviews(w.subId);
  const sold = sizesSold(w);
  w.usChart = await buildSizeGuide(ctx.model(), ctx.models, {
    title: p.title,
    sizesSold: sold,
    seller: w.sellerChart!,
    usFit: fitEvidenceFor(reviews, w.analysis ?? null, 'US'),
  });
  const charted = new Set((w.usChart?.rows ?? []).map((r) => normSize(r.size)));
  const missing = sold.filter((s) => !charted.has(normSize(s)));
  if (!w.usChart) w.holdReasons = [...(w.holdReasons ?? []), "The supplier's chart doesn't cover the sizes sold, so there is no size guide"];
  else if (missing.length) w.holdReasons = [...(w.holdReasons ?? []), `Size guide is missing ${missing.join(', ')}`];
  w.stage = 'shipping';
  return { work: w, finished: false };
}

async function stageShipping(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const skus = usSkus(w);
  w.shipping = Object.fromEntries(await shippingBySku(ctx, w.product!.mainId, skus, w.freight ?? []));
  const noCost = skus.filter((k) => k.priceCents === null || k.priceCents <= 0);
  const noShip = skus.filter((k) => w.shipping![k.skuId] === undefined);
  const hold = [...(w.holdReasons ?? [])];
  if (noCost.length) hold.push(`Supplier price missing for ${noCost.length} variant(s)`);
  if (noShip.length) hold.push(`No US shipping quote for ${noShip.length} variant(s)`);
  w.holdReasons = hold;
  w.stage = 'listing';
  return { work: w, finished: false };
}

async function stageListing(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const sc = screen(w.product!, w.freight ?? [], ctx.config);
  w.listing = await writeListing(
    ctx.model(),
    ctx.models,
    {
      product: w.product!,
      skus: usSkus(w),
      department: 'men',
      material: w.material ?? null,
      sizeChart: w.usChart && 'columns' in w.usChart ? w.usChart : null,
      listingFixes: w.result!.listingFixes,
      delivery: sc.shipping ? { minDays: sc.shipping.minDays, maxDays: sc.shipping.maxDays } : null,
      reviewSummary: w.analysis?.summary ?? '',
    },
    ctx.config,
    ctx.fetchImpl,
  );
  w.holdReasons = [...(w.holdReasons ?? []), ...w.listing.problems.map((p) => `Listing: ${p}`)];
  w.stage = 'save';
  return { work: w, finished: false };
}

async function stageSave(ctx: PipelineContext, w: WorkState): Promise<StepResult> {
  const now = (ctx.now ?? Date.now)();
  const { config } = ctx;
  const product = w.product!;
  const result = w.result!;
  const { draft } = w.listing!;
  const productId = `ae-${product.mainId}`;
  const sc = screen(product, w.freight ?? [], config);
  const shipping = w.shipping ?? {};
  const fallback = Math.max(0, ...Object.values(shipping), sc.shipping?.feeCents ?? 0);
  const holdReasons = [...(w.holdReasons ?? [])];

  const names = new Map(draft.variants.map((v) => [v.skuId, v]));
  const sourcingSkus: SourcingSku[] = usSkus(w).map((s) => {
    const shippingCents = shipping[s.skuId] ?? fallback;
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
  // Nothing goes live by itself: every product waits for your three checks in the dashboard.
  const status: ProductDoc['status'] = existing?.status === 'retired' ? 'retired' : 'pending_review';
  // Work started by the previous version may hold the old blended chart: don't use it.
  const usChart = w.usChart && 'columns' in w.usChart ? w.usChart : null;
  if (w.usChart && !usChart) holdReasons.push('Size guide was built by the old method; re-vet to rebuild it from supplier measurements');

  const productDoc: ProductDoc = {
    id: productId,
    handle: draft.handle,
    status,
    holdReasons,
    decision: result.decision,
    department: 'men',
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
    priceFromCents: prices.length ? Math.min(...prices) : 0,
    priceToCents: prices.length ? Math.max(...prices) : 0,
    freeShipping: config.pricing.freeShipping,
    delivery: { minDays: sc.shipping?.minDays ?? null, maxDays: sc.shipping?.maxDays ?? null },
    material: w.material ?? null,
    origin: 'Imported',
    sizeChart: usChart
      ? { label: usChart.label, unit: usChart.unit, measurementType: usChart.measurementType, columns: usChart.columns, rows: usChart.rows, fitType: usChart.fitType, fitNotes: usChart.fitNotes }
      : null,
    probation: existing?.probation ?? {
      active: true, orders: 0, defects: 0,
      maxDefects: result.decision === 'import' ? 2 : 1,
      windowOrders: result.decision === 'import' ? 40 : 20,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    publishedAt: existing?.publishedAt ?? null,
    quality: existing?.quality,
    flags: existing?.flags,
  };
  const sourcing: SourcingDoc = {
    productId,
    aeSubId: product.subId,
    aeMainId: product.mainId,
    storeId: product.store.storeId,
    storeName: product.store.name,
    feeds: w.candidate.feeds,
    skus: sourcingSkus,
    shipping: sc.shipping,
    supplierUrl: `https://www.aliexpress.com/item/${product.mainId}.html`,
    lastCheckedAt: now,
    lastCheck: { ok: true, notes: ['Imported'] },
    supplier: { title: product.title, images: product.images.map(imageKey), material: product.attributes.Material ?? null },
    reviewWatch: { seenIds: (await ctx.repo.getWorkReviews(w.subId)).map((r) => r.id).slice(0, 1000), lastCheckedAt: now },
    updatedAt: now,
  };
  await ctx.repo.saveProduct(productDoc, sourcing, await vettingDoc(ctx, w, now));
  const outcome: Outcome = result.decision === 'import' && holdReasons.length === 0 ? 'ready' : 'held';
  return finish(ctx, w, outcome, 'held', outcome === 'ready' ? result.reasons : holdReasons, null, productId);
}

/** An image's file name: AliExpress serves the same photo from several hosts. */
export function imageKey(url: string): string {
  return url.split('?')[0]!.split('/').pop()!.replace(/_\d+x\d+.*$/, '');
}

async function vettingDoc(ctx: PipelineContext, w: WorkState, now: number): Promise<VettingDoc> {
  const reviews = await ctx.repo.getWorkReviews(w.subId);
  const buyerPhotos = reviews
    .filter((r) => r.imageUrls?.length)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 12)
    .map((r) => ({ reviewId: r.id, url: r.imageUrls![0]!, stars: r.stars, country: r.country, date: r.date, text: r.text.slice(0, 200) }));
  return {
    photoCheck: w.photoCheck ?? null,
    buyerPhotos,
    productId: `ae-${w.product!.mainId}`,
    aeMainId: w.product!.mainId,
    result: w.result!,
    reviewSummary: w.analysis?.summary ?? '',
    materialFromReviews: w.analysis?.materialFromReviews ?? null,
    imageCheck: w.imageCheck ?? null,
    sellerSizeChart: w.sellerChart ?? null,
    usSizeChartReasoning: w.usChart?.reasoning ?? null,
    listingProblems: w.listing?.problems ?? [],
    evidence: w.listing?.evidence ?? [],
    claims: w.listing?.draft.claims ?? [],
    models: ctx.models,
    version: VETTING_VERSION,
    vettedAt: now,
  };
}

function usSkus(w: WorkState): Sku[] {
  const ids = new Set(w.result!.usSkuIds);
  return w.product!.skus.filter((s) => ids.has(s.skuId));
}

function sizesSold(w: WorkState): string[] {
  return [...new Set(usSkus(w).map((s) => s.props.Size).filter((x): x is string => !!x))];
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

function ratingsPass(r: SellerDoc['ratings'], config: VettingConfig) {
  return [r.asDescribed, r.communication, r.shipping].every((x) => x !== null && x >= config.minStoreRating);
}

function ratingsText(r: SellerDoc['ratings'], config: VettingConfig) {
  return `As described ${r.asDescribed ?? '–'}, communication ${r.communication ?? '–'}, shipping ${r.shipping ?? '–'} (need ${config.minStoreRating}+ each)`;
}

/** Keeps every store's latest ratings, so later items from a weak store are screened without API calls. */
async function rememberStore(ctx: PipelineContext, product: ProductSnapshot, now: number) {
  const s = product.store;
  if (!s.storeId) return;
  const existing = await ctx.repo.getSeller(s.storeId);
  await ctx.repo.saveSeller({
    storeId: s.storeId,
    name: s.name,
    ratings: s.ratings,
    productsVetted: existing?.productsVetted ?? 0,
    productsRejected: existing?.productsRejected ?? 0,
    strikes: existing?.strikes ?? {},
    blocked: existing?.blocked ?? false,
    blockReasons: existing?.blockReasons ?? [],
    fingerprint: existing?.fingerprint ?? null,
    ratingsCheckedAt: now,
    updatedAt: now,
  });
}

interface SellerState extends SellerDoc {
  linkedTo: string[];
}

function fingerprint(product: ProductSnapshot, shipping: ReturnType<typeof screen>['shipping']): string | null {
  if (!shipping) return null;
  const cheapest = Math.min(...product.skus.map((s) => s.priceCents ?? Infinity));
  const band = cheapest < 500 ? 'under5' : cheapest < 1500 ? 'under15' : 'over15';
  return [shipping.carrier, shipping.feeCents, `${shipping.minDays}-${shipping.maxDays}`, band].join('|');
}

async function sellerState(ctx: PipelineContext, product: ProductSnapshot, shipping: ReturnType<typeof screen>['shipping']): Promise<SellerState> {
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
    ratingsCheckedAt: existing?.ratingsCheckedAt,
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
  if (!s.blocked && result.sellerStrikes.length > 0) await pauseSellerProducts(ctx, s.storeId, blockReasons);
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

export async function pauseSellerProducts(ctx: Pick<PipelineContext, 'repo' | 'log'>, storeId: string, reasons: string[]) {
  for (const id of await ctx.repo.productIdsByStore(storeId)) {
    const p = await ctx.repo.getProduct(id);
    if (p && (p.status === 'live' || p.status === 'pending_review')) {
      await ctx.repo.updateProduct(id, { status: 'paused', holdReasons: [`Seller blocked: ${reasons.join('; ')}`], review: CLEARED_CHECKS });
      ctx.log(`Paused ${id}: its seller is blocked`);
    }
  }
}

// ---------------------------------------------------------------- monitor

export async function monitorProduct(ctx: PipelineContext, p: ProductDoc): Promise<{ changed: boolean; notes: string[] }> {
  const now = (ctx.now ?? Date.now)();
  const src = await ctx.repo.getSourcing(p.id);
  if (!src) return { changed: false, notes: ['No sourcing record'] };
  const notes: string[] = [];
  const pauseWith = async (reasons: string[]) => {
    if (p.status === 'live') await ctx.repo.updateProduct(p.id, { status: 'paused', holdReasons: reasons, review: CLEARED_CHECKS });
    await ctx.repo.updateSourcing(p.id, { lastCheckedAt: now, lastCheck: { ok: false, notes: reasons } });
    return { changed: p.status === 'live', notes: reasons };
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
  const priceOf = new Map(p.variants.map((v) => [v.id, v.priceCents]));
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
    // Pause when today's cost leaves less than the minimum profit at the current price.
    const price = priceOf.get(s.aeSkuId);
    if (price) {
      const profit = profitCents(price, landed, ctx.config.pricing);
      if (profit < ctx.config.pricing.minProfitCents) {
        notes.push(
          `Variant ${s.aeSkuId} costs $${(landed / 100).toFixed(2)}; profit at $${(price / 100).toFixed(2)} is $${(profit / 100).toFixed(2)}, under the $${(ctx.config.pricing.minProfitCents / 100).toFixed(2)} minimum. Reprice before selling`,
        );
        pause = true;
      }
    }
    return { ...s, costCents: cost, shippingCents: ship, landedCents: landed, stock: live.stock ?? 0 };
  });
  // Out-of-stock sizes are hidden from shoppers; the product pauses only when none are left.
  const inStock = new Map(skus.map((s) => [s.aeSkuId, s.stock > 0]));
  const variants = p.variants.map((v) => ({ ...v, inStock: inStock.get(v.id) ?? false }));
  if (!variants.some((v) => v.inStock)) {
    notes.push('No variant is in stock with US shipping');
    pause = true;
  }

  // Flags for a person: the supplier changed the listing, or new reviews report unfixable problems.
  const flags: string[] = [];
  if (src.supplier) {
    if (snap.title.trim() !== src.supplier.title.trim()) flags.push(`Supplier changed the title to "${snap.title.slice(0, 120)}"`);
    const before = new Set(src.supplier.images);
    const after = snap.images.map(imageKey);
    const changedPhotos = after.filter((k) => !before.has(k)).length + src.supplier.images.filter((k) => !after.includes(k)).length;
    if (changedPhotos) flags.push(`Supplier changed ${changedPhotos} product photo(s)`);
    const material = snap.attributes.Material ?? null;
    if ((material ?? '').toLowerCase() !== (src.supplier.material ?? '').toLowerCase()) {
      flags.push(`Supplier material changed from "${src.supplier.material ?? 'not stated'}" to "${material ?? 'not stated'}"`);
    }
  }
  const watch = await watchReviews(ctx, src.aeMainId, snap.title, src.reviewWatch?.seenIds ?? null);
  flags.push(...watch.flags);
  // A product that isn't live can't be paused; what would have paused it becomes a flag instead.
  if (pause && p.status !== 'live') flags.push(...notes);

  await ctx.repo.updateSourcing(p.id, {
    skus,
    lastCheckedAt: now,
    lastCheck: { ok: !pause && !flags.length, notes: [...new Set([...notes, ...flags])] },
    // Today's listing becomes the baseline, so each supplier change is flagged once.
    supplier: { title: snap.title, images: snap.images.map(imageKey), material: snap.attributes.Material ?? null },
    ...(watch.seenIds ? { reviewWatch: { seenIds: watch.seenIds, lastCheckedAt: now } } : {}),
  });
  const patch: Partial<ProductDoc> = { variants };
  if (pause && p.status === 'live') {
    patch.status = 'paused';
    patch.holdReasons = notes;
    patch.review = CLEARED_CHECKS; // publishing again means checking again
  }
  if (flags.length) patch.flags = addFlags(p.flags, flags.map((text) => ({ at: now, source: 'monitor' as const, text })));
  await ctx.repo.updateProduct(p.id, patch);
  return {
    changed: (pause && p.status === 'live') || flags.length > 0 || variants.some((v, i) => v.inStock !== p.variants[i]?.inStock),
    notes: [...notes, ...flags],
  };
}

export const CLEARED_CHECKS = { reverseImage: false, noBrandResemblance: false, listingRead: false, by: null, at: null };

/** Keeps the 50 latest flags and doesn't repeat one that's already there. */
export function addFlags(existing: ProductFlag[] | undefined, add: ProductFlag[]): ProductFlag[] {
  const have = new Set((existing ?? []).map((f) => f.text));
  return [...(existing ?? []), ...add.filter((f) => !have.has(f.text))].slice(-50);
}

const WATCH_PAGES = 3;

/** Reads the newest review pages and flags unfixable (C) problems in reviews not seen before. */
async function watchReviews(
  ctx: PipelineContext,
  mainId: string,
  title: string,
  seen: string[] | null,
): Promise<{ flags: string[]; seenIds: string[] | null }> {
  const getPage = ctx.fetchReviewPage ?? fetchReviewPage;
  const fresh: Review[] = [];
  const all: string[] = [];
  try {
    for (let page = 1; page <= WATCH_PAGES; page++) {
      const res = await getPage(mainId, page, { fetchImpl: ctx.fetchImpl, sleep: ctx.sleep });
      for (const r of res.reviews) {
        all.push(r.id);
        if (seen && !seen.includes(r.id)) fresh.push(r);
      }
      if (page >= res.totalPages) break;
      await (ctx.sleep ?? ((ms) => new Promise((res2) => setTimeout(res2, ms))))(1200);
    }
  } catch (e) {
    return { flags: [], seenIds: null }; // the review endpoint is unofficial; try again next time
  }
  const withText = textReviews(fresh);
  const seenIds = [...new Set([...(seen ?? []), ...all])].slice(-1000);
  if (!seen || !withText.length) return { flags: [], seenIds };
  try {
    const a = await analyzeReviewChunk(ctx.model(), ctx.models, withText.slice(0, ANALYSIS_CHUNK), { title, material: null, now: (ctx.now ?? Date.now)() });
    const flags = a.issues
      .filter((i) => ISSUE_RULES[i.category]?.bucket === 'C')
      .map((i) => `New review: ${ISSUE_RULES[i.category].label} ("${i.quote.slice(0, 120)}")`);
    return { flags, seenIds };
  } catch {
    // Leave the unread reviews unseen so the next run reads them; the rest of the check still counts.
    const unread = new Set(withText.map((r) => r.id));
    return { flags: ['New written reviews could not be read by Claude; they will be read on the next run'], seenIds: seenIds.filter((id) => !unread.has(id)) };
  }
}

/** Recomputes retail prices from today's costs (Products → Reprice), resetting the drift baseline. */
export function repriceVariants(p: ProductDoc, src: SourcingDoc, pricing: VettingConfig['pricing']) {
  const byId = new Map(src.skus.map((s) => [s.aeSkuId, s]));
  const variants = p.variants.map((v) => {
    const s = byId.get(v.id);
    return s ? { ...v, priceCents: retailPriceCents(s.landedCents, pricing) } : v;
  });
  const skus = src.skus.map((s) => ({ ...s, pricedLandedCents: s.landedCents }));
  const prices = variants.map((v) => v.priceCents);
  return { variants, skus, priceFromCents: Math.min(...prices), priceToCents: Math.max(...prices) };
}

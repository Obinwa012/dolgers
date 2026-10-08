/**
 * Firestore documents. Only `products` with status "live" is public; every other collection is
 * server-only and written by the pipeline with the Admin SDK.
 *
 *   products/{productId}     the storefront product (public when live)
 *   sourcing/{productId}     supplier ids, costs, stock, shipping, monitoring history (private)
 *   vetting/{productId}      the full decision record with evidence (private)
 *   sellers/{storeId}        seller ratings, strikes, blocks (private)
 *   candidates/{subId}       the import queue and why each item stopped where it did (private)
 *   config/pipeline          tunable thresholds, AI models, feeds (private)
 *   config/secrets           AliExpress and Claude credentials and tokens (server-only)
 *   jobs/{id}                import / vet / monitor runs started from the dashboard (private)
 *   work/{subId}             a candidate's vetting in progress, saved after every stage (private)
 *
 * productId = "ae-" + AliExpress main product id, so a product is never imported twice.
 */
import type { UsSizeChart } from '../ai/size-chart.ts';
import type { ListingDraft, StoreCategory } from '../listing/listing.ts';
import type { Cents, ShippingOption } from '../types.ts';
import type { Decision, VetResult } from '../vetting/engine.ts';

export type ProductStatus = 'live' | 'pending_review' | 'paused' | 'retired';

export interface ProductVariant {
  /** Our variant id (= AliExpress SKU id; the order service maps it back). */
  id: string;
  color: string;
  size: string;
  priceCents: Cents;
  inStock: boolean;
}

export interface ProductDoc {
  id: string;
  handle: string;
  status: ProductStatus;
  /** Why it isn't live yet, for the admin review queue. */
  holdReasons: string[];
  decision: Decision;
  department: 'men';
  category: StoreCategory;
  title: string;
  bullets: string[];
  description: string[];
  faq: { q: string; a: string }[];
  seo: ListingDraft['seo'] & { keywordStatus: 'guess' | 'checked' | 'proven' };
  images: { url: string; alt: string }[];
  variants: ProductVariant[];
  colors: string[];
  sizes: string[];
  priceFromCents: Cents;
  priceToCents: Cents;
  freeShipping: boolean;
  delivery: { minDays: number | null; maxDays: number | null };
  material: string | null;
  origin: 'Imported';
  sizeChart: Pick<UsSizeChart, 'fitType' | 'rows' | 'fitNotes'> | null;
  /** First-orders monitoring: delist rule applies until enough clean orders are seen. */
  probation: { active: boolean; orders: number; defects: number; maxDefects: number; windowOrders: number };
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface SourcingSku {
  aeSkuId: string;
  props: Record<string, string>;
  costCents: Cents;
  shippingCents: Cents;
  landedCents: Cents;
  /** The landed cost the retail price was calculated from. Monitoring compares against this. */
  pricedLandedCents: Cents;
  stock: number;
}

export interface SourcingDoc {
  productId: string;
  aeSubId: string;
  aeMainId: string;
  storeId: string;
  storeName: string;
  feeds: string[];
  skus: SourcingSku[];
  shipping: ShippingOption | null;
  supplierUrl: string;
  lastCheckedAt: number;
  lastCheck: { ok: boolean; notes: string[] };
  updatedAt: number;
}

export interface VettingDoc {
  productId: string;
  aeMainId: string;
  result: VetResult;
  reviewSummary: string;
  materialFromReviews: string | null;
  imageCheck: { ipRisk: boolean; findings: string[]; printDescription: string; checked: number } | null;
  sellerSizeChart: unknown;
  usSizeChartReasoning: string | null;
  listingProblems: string[];
  evidence: { id: string; fact: string; source: string }[];
  claims: { text: string; evidenceIds: string[] }[];
  models: { fast: string; careful: string };
  version: number;
  vettedAt: number;
}

export interface SellerDoc {
  storeId: string;
  name: string;
  ratings: { asDescribed: number | null; communication: number | null; shipping: number | null };
  productsVetted: number;
  productsRejected: number;
  strikes: Record<string, number>;
  blocked: boolean;
  blockReasons: string[];
  /** carrier|fee|days|labels: stores sharing a blocked seller's fingerprint get a review flag. */
  fingerprint: string | null;
  updatedAt: number;
}

export type CandidateStatus =
  | 'new'
  | 'vetting'
  | 'screened_out'
  | 'insufficient_data'
  | 'rejected'
  | 'held'
  | 'published'
  | 'error';

export interface CandidateDoc {
  subId: string;
  mainId: string | null;
  feeds: string[];
  title: string;
  department: 'men';
  categoryId: string | null;
  subcategoryName: string | null;
  shopId: string | null;
  recentSales: number;
  feedPriceCents: Cents | null;
  status: CandidateStatus;
  /** recentSales, present only while status is "new": the queue is ordered by it. */
  queueSales?: number;
  reasons: string[];
  /** When a screened-out or insufficient candidate should be looked at again. */
  nextCheckAt: number | null;
  attempts: number;
  createdAt: number;
  updatedAt: number;
}

export interface RunDoc {
  id: string;
  command: string;
  args: Record<string, unknown>;
  startedAt: number;
  finishedAt: number | null;
  counts: Record<string, number>;
  errors: string[];
}

// ---------------------------------------------------------------- settings

/**
 * config/secrets: API credentials, written and read only on the server (Admin SDK). Field names
 * are the ones the previous admin app used, so keys saved there keep working.
 */
export interface SecretsDoc {
  aeAppKey?: string;
  aeAppSecret?: string;
  aeAccessToken?: string;
  aeRefreshToken?: string | null;
  aeExpiresAt?: number;
  aeRefreshExpiresAt?: number | null;
  anthropicApiKey?: string;
  updatedAt?: number;
}

/** config/pipeline: everything tunable from Settings → DOLGERS. */
export interface PipelineSettings {
  /** Threshold overrides; missing fields fall back to DEFAULT_CONFIG. */
  vetting?: Partial<import('../vetting/config.ts').VettingConfig>;
  aiModels?: { fast?: string; careful?: string };
  feeds?: string[];
  importPages?: number;
  updatedAt?: number;
}

// ---------------------------------------------------------------- jobs

export type JobType = 'import' | 'vet' | 'monitor';
export type JobStatus = 'running' | 'paused' | 'done' | 'stopped' | 'error';

export interface JobLogLine {
  at: number;
  text: string;
  /** For vet jobs: the candidate's outcome, so the page can colour the line. */
  outcome?: string;
  productId?: string;
}

/** A unit of work the dashboard advances one short step at a time (jobs/{id}). */
export interface JobDoc {
  id: string;
  type: JobType;
  status: JobStatus;
  /** subId: vet just this candidate (from the queue page). */
  params: { limit?: number; pages?: number; feeds?: string[]; subId?: string };
  /** Import: which feed and page is next. Vet: the candidate in progress. Monitor: product ids left. */
  cursor: { feedIndex?: number; page?: number; current?: string | null; queue?: string[]; failures?: number };
  progress: { done: number; total: number | null };
  counts: Record<string, number>;
  log: JobLogLine[];
  lockedUntil: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  error: string | null;
}

// ---------------------------------------------------------------- vetting work in progress

export type WorkStage =
  | 'fetch'
  | 'reviews'
  | 'images'
  | 'analysis'
  | 'decide'
  | 'seller_chart'
  | 'us_chart'
  | 'shipping'
  | 'listing'
  | 'save'
  | 'done';

/**
 * work/{subId}: one candidate's vetting, saved after every stage so each request stays short and a
 * timeout or closed tab resumes where it stopped. Reviews live in work/{subId}/parts/reviews.
 */
export interface WorkState {
  subId: string;
  stage: WorkStage;
  /** Tries at the current stage; reset when a stage completes. */
  attempts: number;
  lastError?: string;
  candidate: CandidateDoc;
  product?: import('../types.ts').ProductSnapshot;
  freight?: import('../types.ts').FreightQuote[];
  reviewsFirst?: { set: Omit<import('../types.ts').ReviewSet, 'mainId' | 'reviews' | 'complete' | 'sampled' | 'fetchedAt'>; totalPages: number; writtenTotal: number };
  reviewsNextPage?: number;
  reviewsFailed?: boolean;
  imageCheck?: { ipRisk: boolean; findings: string[]; printDescription: string; checked: number };
  analysisChunk?: number;
  analysisParts?: import('../vetting/engine.ts').ReviewAnalysis[];
  analysis?: import('../vetting/engine.ts').ReviewAnalysis;
  result?: VetResult;
  holdReasons?: string[];
  material?: string | null;
  sellerChart?: import('../ai/size-chart.ts').SellerSizeChart;
  usChart?: UsSizeChart | null;
  shipping?: Record<string, number>;
  listing?: import('../listing/listing.ts').ListingResult;
  outcome?: string;
  reasons?: string[];
  productId?: string;
  startedAt: number;
  updatedAt: number;
}

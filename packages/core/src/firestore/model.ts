/**
 * Firestore documents. Only `products` with status "live" is public; every other collection is
 * server-only and written by the pipeline with the Admin SDK.
 *
 *   products/{productId}     the storefront product (public when live)
 *   sourcing/{productId}     supplier ids, costs, stock, shipping, monitoring history (private)
 *   vetting/{productId}      the full decision record with evidence (private)
 *   sellers/{storeId}        seller ratings, strikes, blocks (private)
 *   candidates/{subId}       the import queue and why each item stopped where it did (private)
 *   runs/{runId}             pipeline run logs (private)
 *   config/pipeline          tunable thresholds (private)
 *   config/aliexpress        API tokens (private)
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
  department: 'men' | 'women';
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
  department: 'men' | 'women';
  categoryId: string | null;
  subcategoryName: string | null;
  shopId: string | null;
  recentSales: number;
  feedPriceCents: Cents | null;
  status: CandidateStatus;
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

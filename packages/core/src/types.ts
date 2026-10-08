/**
 * Shared types for the sourcing pipeline.
 *
 * Money is integer US cents everywhere. Timestamps are epoch milliseconds.
 * "subId" is the US-site product id (3256…) the feeds return; "mainId" is the
 * global product id (1005…) that freight quotes, orders and reviews use.
 */

export type Cents = number;

export interface FeedItem {
  subId: string;
  feedName: string;
  title: string;
  categoryId: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  /** The feed's cached price. Not a cost: often a stale promo or a bait variant. */
  feedPriceCents: Cents | null;
  recentSales: number;
  shopId: string | null;
  sellerId: string | null;
  mainImage: string | null;
}

export interface StoreInfo {
  storeId: string;
  name: string;
  country: string | null;
  ratings: {
    asDescribed: number | null;
    communication: number | null;
    shipping: number | null;
  };
}

export interface Sku {
  skuId: string;
  /** Property name → value, e.g. { Color: 'black', Size: 'L', 'Ships From': 'United States' }. */
  props: Record<string, string>;
  shipsFrom: string | null;
  priceCents: Cents | null;
  listPriceCents: Cents | null;
  stock: number | null;
  image: string | null;
}

export interface ProductSnapshot {
  subId: string;
  mainId: string;
  title: string;
  status: string;
  categoryId: string | null;
  reviewCount: number;
  avgRating: number | null;
  salesLabel: string | null;
  /** AliExpress "separated listing" product: its reviews are pooled across sellers. */
  pooledListing: boolean;
  store: StoreInfo;
  attributes: Record<string, string>;
  skus: Sku[];
  images: string[];
  descriptionImages: string[];
  descriptionText: string;
  grossWeightKg: number | null;
  fetchedAt: number;
}

export interface ShippingOption {
  carrier: string;
  code: string;
  shipFrom: string | null;
  feeCents: Cents;
  free: boolean;
  minDays: number | null;
  maxDays: number | null;
  guaranteedDays: number | null;
  tracking: boolean;
}

export interface FreightQuote {
  skuId: string;
  quantity: number;
  options: ShippingOption[];
  error: string | null;
}

export interface Review {
  id: string;
  buyer: string;
  anonymous: boolean;
  country: string;
  stars: number;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  skuInfo: string;
  shipsFromUS: boolean;
  logistics: string;
  text: string;
  additionalText: string;
  images: number;
  labels: Record<string, string>;
  selected: boolean;
}

export interface ReviewStats {
  total: number;
  avg: number | null;
  byStars: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export interface ReviewSet {
  mainId: string;
  /** ORDINARY = this listing's own reviews; HYPERCHAIN (or a pooled notice) = pooled across sellers. */
  productType: string;
  pooledNotice: string | null;
  stats: ReviewStats;
  filterCounts: Record<string, number>;
  reviews: Review[];
  /** False when pages that should exist could not be fetched. */
  complete: boolean;
  /** True when the listing has more reviews than we fetch (the most recent pages are a sample). */
  sampled: boolean;
  fetchedAt: number;
}

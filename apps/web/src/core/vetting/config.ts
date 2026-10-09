/**
 * Every threshold the pipeline uses. Stored in Firestore at config/pipeline so they can be
 * tuned without a deploy; these are the defaults when that document is missing a field.
 */
export interface VettingConfig {
  /** Bumped when the rules change meaning; saved settings from an older version are ignored. */
  version: number;
  /** Each of the three store ratings must reach this. */
  minStoreRating: number;
  /** All three ratings at or above this count as a strong seller (needed for probation). */
  strongSellerRating: number;
  /** Unique buyers with the listing's own reviews needed for a plain import. */
  importMinBuyers: number;
  /** Below this, the product is "insufficient data". Also the review count needed to vet at all. */
  probationMinBuyers: number;
  /** Written reviews needed for a plain import (stars alone can't explain problems). */
  importMinTextReviews: number;
  /** Reviews written in the last `recentDays` days needed to judge the product as it is made now. */
  minRecentReviews: number;
  recentDays: number;
  /**
   * Customer-service (B) problems: the one-sided 95% Wilson upper bound on the share of buyers
   * with a problem must be at or below this. With no problems that takes ~52 buyers at 5%.
   */
  maxProblemUpperBound: number;
  /** The same bound for probation products (20–59 buyers). */
  probationMaxUpperBound: number;
  /** Unfixable (C) problems reject when at least this many buyers report one… */
  systemicRejectBuyers: number;
  /** …and they are more than this share of buyers. Fewer reports flag the product for review. */
  systemicRejectShare: number;
  /** Flag when the last-90-days problem rate is more than this many times the overall rate. */
  recentProblemRatio: number;
  /** Fake-review signals (flags, not rejections). */
  fakeReviews: {
    /** The three busiest days hold at least this share of written reviews. */
    burstShare: number;
    /** At least this many reviews are near-identical to another review. */
    duplicateReviews: number;
    /** At least this share of all ratings are 5 stars with no text. */
    noText5StarShare: number;
  };
  /** At least this share of reviews must show "Ships From: United States". */
  minUsVariantShare: number;
  /** At most this share of reviews may have shipped by a China carrier. */
  maxChinaLogisticsShare: number;
  /** Longest delivery promise before the product is flagged, in days. */
  maxDeliveryDays: number;
  /** A "Priority" carrier quoted at or below this fee, on an item at or below the next value, is suspicious. */
  suspiciousShippingMaxFeeCents: number;
  suspiciousShippingMaxItemCents: number;
  /** Rechecks for products that were "insufficient data". */
  recheckAfterDays: number;
  /**
   * Feed items with fewer sales than this aren't imported: about 1 in 4–6 buyers leaves a review,
   * so ~80 sales is roughly where a listing can have the 20 reviews needed to vet it at all.
   */
  importMinSales: number;
  /** Your own orders: pause a product whose refund rate passes this, once it has enough orders. */
  maxRefundRate: number;
  refundRateMinOrders: number;
  pricing: {
    /**
     * Price = (cost + return reserve + profit + fixed fee) ÷ (1 − fee rate), rounded up to $X.99,
     * where cost = item + shipping to the customer and reserve = rate × (cost + return shipping).
     */
    profitCents: number;
    returnReserveRate: number;
    returnShippingCents: number;
    paymentFeeRate: number;
    paymentFeeFixedCents: number;
    /** Monitor pauses a product when a cost rise drops its profit below this. */
    minProfitCents: number;
    /** Shipping is built into the price and the customer sees free shipping. */
    freeShipping: boolean;
  };
  /** Words that make a title or attribute an IP risk (brands, celebrities, characters, "dupe"). */
  ipBlocklist: string[];
}

export const CONFIG_VERSION = 3;

export const DEFAULT_CONFIG: VettingConfig = {
  version: CONFIG_VERSION,
  minStoreRating: 4.5,
  strongSellerRating: 4.7,
  importMinBuyers: 60,
  probationMinBuyers: 20,
  importMinTextReviews: 15,
  minRecentReviews: 5,
  recentDays: 90,
  maxProblemUpperBound: 0.05,
  probationMaxUpperBound: 0.05,
  systemicRejectBuyers: 2,
  systemicRejectShare: 0.01,
  recentProblemRatio: 2,
  fakeReviews: { burstShare: 0.5, duplicateReviews: 3, noText5StarShare: 0.8 },
  minUsVariantShare: 0.9,
  maxChinaLogisticsShare: 0.1,
  maxDeliveryDays: 7,
  suspiciousShippingMaxFeeCents: 399,
  suspiciousShippingMaxItemCents: 800,
  recheckAfterDays: 30,
  importMinSales: 80,
  maxRefundRate: 0.1,
  refundRateMinOrders: 10,
  pricing: {
    profitCents: 800,
    returnReserveRate: 0.2,
    returnShippingCents: 600,
    paymentFeeRate: 0.029,
    paymentFeeFixedCents: 30,
    minProfitCents: 700,
    freeShipping: true,
  },
  ipBlocklist: [
    'dupe', 'dupes', 'inspired', 'replica', 'replicas',
    'nike', 'adidas', 'jordan', 'puma', 'under armour', 'new balance', 'reebok', 'converse', 'vans',
    'supreme', 'gucci', 'prada', 'louis vuitton', 'chanel', 'dior', 'versace', 'balenciaga',
    'ralph lauren', 'polo ralph', 'tommy hilfiger', 'calvin klein', 'levi', 'carhartt', 'dickies', 'ariat',
    'harley', 'porsche', 'ferrari', 'bmw', 'mercedes', 'rhude', 'gallery dept', 'essentials fear of god',
    'disney', 'marvel', 'dc comics', 'star wars', 'pokemon', 'hello kitty', 'sanrio', 'harry potter',
    'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'michael jackson', 'tupac', 'taylor swift', 'iron maiden',
    'metallica', 'nirvana', 'the smiths', 'tool band', 'stephen curry', 'allen iverson', 'anthony edwards',
    'john pork', 'tung tung tung sahur', 'amazing digital circus', 'skims', 'stanley',
  ],
};

/** Words in the blocklist that aren't brand names, so they aren't checked for misspellings. */
export const NON_BRAND_TERMS = new Set(['dupe', 'dupes', 'inspired', 'replica', 'replicas']);

export function mergeConfig(partial: Partial<VettingConfig> | undefined): VettingConfig {
  // Settings saved under older rules (different meaning, e.g. 30 buyers to import) are ignored.
  const p = partial?.version === CONFIG_VERSION ? partial : undefined;
  // Words you added to the blocklist under the old rules are kept ("off-white" is a colour too).
  const oldWords = !p && partial?.ipBlocklist ? partial.ipBlocklist.filter((w) => w !== 'off-white') : [];
  return {
    ...DEFAULT_CONFIG,
    ...(p ?? {}),
    version: CONFIG_VERSION,
    fakeReviews: { ...DEFAULT_CONFIG.fakeReviews, ...(p?.fakeReviews ?? {}) },
    pricing: { ...DEFAULT_CONFIG.pricing, ...(p?.pricing ?? {}) },
    ipBlocklist: p?.ipBlocklist ?? [...new Set([...DEFAULT_CONFIG.ipBlocklist, ...oldWords])],
  };
}

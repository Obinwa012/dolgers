/**
 * Every threshold the pipeline uses. Stored in Firestore at config/pipeline so they can be
 * tuned without a deploy; these are the defaults when that document is missing a field.
 */
export interface VettingConfig {
  /** Each of the three store ratings must reach this. */
  minStoreRating: number;
  /** All three ratings at or above this count as a strong seller (backing for probation). */
  strongSellerRating: number;
  /** Unique buyers with the listing's own reviews needed for a plain import. */
  importMinBuyers: number;
  /** Below this, the product is "insufficient data". */
  probationMinBuyers: number;
  /** Written reviews needed for a plain import (stars alone can't explain problems). */
  importMinTextReviews: number;
  /** Max share of buyers with absorbable (B) problems after listing fixes: 1 in 40. */
  maxProblemRate: number;
  /** Independent buyers reporting the same systemic (C) problem that trigger a reject. */
  systemicRejectBuyers: number;
  /** At least this share of reviews must show "Ships From: United States". */
  minUsVariantShare: number;
  /** At most this share of reviews may have shipped by a China carrier. */
  maxChinaLogisticsShare: number;
  /** Longest delivery promise we will accept, in days. */
  maxDeliveryDays: number;
  /** A "Priority" carrier quoted at or below this fee, on an item at or below the next value, is suspicious. */
  suspiciousShippingMaxFeeCents: number;
  suspiciousShippingMaxItemCents: number;
  /** Rechecks for products that were "insufficient data". */
  recheckAfterDays: number;
  pricing: {
    /** Retail = landed cost × markup, at least landed cost + minProfit, rounded up to .99. */
    markup: number;
    minProfitCents: number;
    /** Shipping is built into the price and the customer sees free shipping. */
    freeShipping: boolean;
    /** Cost change that pauses a live product until it is repriced and reviewed. */
    maxCostChangeBeforePause: number;
  };
  /** Words that make a title or attribute an IP risk (brands, celebrities, characters). */
  ipBlocklist: string[];
}

export const DEFAULT_CONFIG: VettingConfig = {
  minStoreRating: 4.5,
  strongSellerRating: 4.7,
  importMinBuyers: 30,
  probationMinBuyers: 10,
  importMinTextReviews: 10,
  maxProblemRate: 0.025,
  systemicRejectBuyers: 2,
  minUsVariantShare: 0.9,
  maxChinaLogisticsShare: 0.1,
  maxDeliveryDays: 15,
  suspiciousShippingMaxFeeCents: 399,
  suspiciousShippingMaxItemCents: 800,
  recheckAfterDays: 30,
  pricing: {
    markup: 1.8,
    minProfitCents: 700,
    freeShipping: true,
    maxCostChangeBeforePause: 0.15,
  },
  ipBlocklist: [
    'nike', 'adidas', 'jordan', 'puma', 'under armour', 'new balance', 'reebok', 'converse', 'vans',
    'supreme', 'gucci', 'prada', 'louis vuitton', 'chanel', 'dior', 'versace', 'balenciaga', 'off-white',
    'ralph lauren', 'polo ralph', 'tommy hilfiger', 'calvin klein', 'levi', 'carhartt', 'dickies', 'ariat',
    'harley', 'porsche', 'ferrari', 'bmw', 'mercedes', 'rhude', 'gallery dept', 'essentials fear of god',
    'disney', 'marvel', 'dc comics', 'star wars', 'pokemon', 'hello kitty', 'sanrio', 'harry potter',
    'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'michael jackson', 'tupac', 'taylor swift', 'iron maiden',
    'metallica', 'nirvana', 'the smiths', 'tool band', 'stephen curry', 'allen iverson', 'anthony edwards',
    'john pork', 'tung tung tung sahur', 'amazing digital circus', 'skims', 'stanley',
  ],
};

export function mergeConfig(partial: Partial<VettingConfig> | undefined): VettingConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(partial ?? {}),
    pricing: { ...DEFAULT_CONFIG.pricing, ...(partial?.pricing ?? {}) },
    ipBlocklist: partial?.ipBlocklist ?? DEFAULT_CONFIG.ipBlocklist,
  };
}

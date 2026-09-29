export type IconKey =
  | "drill"
  | "saw"
  | "hammer"
  | "wrench"
  | "battery"
  | "sprout"
  | "box"
  | "flame"
  | "hardhat"
  | "lamp"
  | "nut"
  | "ruler"
  | "fan";

export interface Variant {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  /** True when this option ships with at least one battery (kits). Drives the "Battery included" filter. */
  batteryIncluded?: boolean;
}

/** Voltage platform, for the filter. "Corded" and "Manual" cover tools with no battery platform. */
export type Voltage = "12V" | "18V" | "36V" | "Corded" | "Manual";

export interface SpecRow {
  label: string;
  value: string;
}

export interface QA {
  q: string;
  a: string;
  /** Who answered: "seller" (the listing's seller) or "customer". */
  by: "seller" | "customer";
  date: string; // YYYY-MM-DD
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  brand: string; // brand slug
  category: string; // category slug
  subcategory?: string; // subcategory slug within the category
  /** Seller slug. Missing means sold by Torqline (first party). */
  seller?: string;
  description: string;
  specs: string[]; // short highlights
  specTable?: SpecRow[]; // full specifications
  voltage?: Voltage;
  image?: string; // optional real photo URL; falls back to generated art
  icon: IconKey;
  tint: string; // hex used for generated art
  variants: Variant[];
  tags: string[]; // "new", "featured", "hot", "clearance"
  qa?: QA[];
  /** Product ids shown in "Frequently bought together". */
  boughtTogether?: string[];
  /** Hidden from the storefront when "inactive" (a seller unlisted it or an admin pulled it). */
  listingStatus?: "active" | "inactive";
  rating: number;
  reviewCount: number;
  stock: number;
  createdAt: number;
}

export interface Subcategory {
  slug: string;
  name: string;
  icon: IconKey;
}

export interface Category {
  slug: string;
  name: string;
  icon: IconKey;
  tint: string;
  subcategories?: Subcategory[];
}

/**
 * A marketplace seller. Torqline itself is the seller with slug "torqline".
 * Written only by the server (Admin SDK) after an application is approved.
 */
export interface Seller {
  slug: string;
  name: string;
  tagline: string;
  about: string;
  rating: number; // seller rating out of 5
  ratingCount: number;
  since: string; // YYYY-MM-DD
  location: string;
  color: string;
  /** Business days between order and dispatch. */
  handlingDays: number;
  /** Who handles returns for this seller's items. */
  returns: "torqline" | "seller";
  returnDays: number;
  /** Who a customer contacts for warranty claims. */
  warranty: "manufacturer" | "seller";
  /** Offers free pickup from a Torqline depot (first party only today). */
  pickup?: boolean;
  status?: "active" | "suspended";
}

/**
 * Private side of a seller, kept out of the public `sellers` collection. Doc id = seller slug.
 * Server-only (no client access in firestore.rules).
 */
export interface SellerAccount {
  seller: string;
  ownerUid: string;
  email: string;
  /** Platform commission on this seller's sales, 0–1. Falls back to COMMISSION_RATE. */
  commissionRate?: number;
  stripeAccountId?: string;
  /** Mirrors the Stripe account's `payouts_enabled`, refreshed when the seller opens the dashboard. */
  payoutsEnabled?: boolean;
  createdAt: number;
}

export type ApplicationStatus = "pending" | "approved" | "rejected";

/** A request to sell on Torqline. Doc id = applicant's uid. */
export interface SellerApplication {
  uid: string;
  email: string;
  businessName: string;
  legalName: string;
  businessType: "sole_proprietor" | "llc" | "corporation" | "partnership";
  country: string;
  website: string;
  phone: string;
  categories: string[];
  description: string;
  status: ApplicationStatus;
  createdAt: number;
  decidedAt?: number;
  note?: string; // reason shown to the applicant on rejection
  sellerSlug?: string; // set on approval
}

export type FulfilmentStatus = "awaiting_shipment" | "shipped" | "delivered" | "canceled";

export type PayoutStatus =
  | "held" // not yet shipped
  | "pending_onboarding" // shipped, but the seller hasn't finished Stripe onboarding
  | "transferred"
  | "not_configured" // no Stripe key (demo mode)
  | "none"; // first-party items

/**
 * One seller's share of a paid order. Doc id = `${orderId}_${sellerSlug}`.
 * Created by the Stripe webhook (or demo checkout); only the server writes it.
 */
export interface SellerOrder {
  id?: string;
  orderId: string;
  seller: string;
  uid: string; // customer
  items: Order["items"];
  address: OrderAddress;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  status: FulfilmentStatus;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: number;
  payout: PayoutStatus;
  transferId?: string;
  refundedCents?: number;
  /** Amount clawed back from the seller's transfer for refunds. */
  reversedCents?: number;
  createdAt: number;
}

export type ReturnStatus =
  | "requested"
  | "approved" // refund issued
  | "rejected" // by the seller; the customer can escalate
  | "escalated" // waiting on Torqline
  | "resolved_refund" // Torqline refunded
  | "resolved_denied";

export interface ReturnRequest {
  id?: string;
  orderId: string;
  sellerOrderId: string;
  seller: string;
  uid: string;
  productId: string;
  variantId: string;
  title: string;
  qty: number;
  amountCents: number;
  reason: string;
  details: string;
  status: ReturnStatus;
  sellerNote?: string;
  adminNote?: string;
  refundId?: string;
  /** What was actually refunded (can be less than amountCents after order discounts). */
  refundedCents?: number;
  createdAt: number;
  updatedAt: number;
}

/** A shopper's question on a product, waiting for the seller to answer. */
export interface Question {
  id?: string;
  productId: string;
  seller: string;
  question: string;
  name: string;
  uid: string;
  status: "open" | "answered";
  createdAt: number;
}

export interface Brand {
  slug: string;
  name: string;
  color: string;
  textColor: string;
  icon: IconKey;
}

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  date: string;
  icon: IconKey;
  tint: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  qty: number;
}

export type OrderStatus =
  | "pending_payment" // created by /api/checkout, waiting for Stripe
  | "paid" // confirmed by the Stripe webhook
  | "payment_failed"
  | "canceled" // Checkout session expired or abandoned
  | "placed"; // demo mode (no payment provider configured)

export interface OrderAddress {
  name: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

/**
 * Written only by the server (Admin SDK). Money fields are dollars for display; the `*Cents`
 * fields are the authoritative amounts used to charge the customer.
 */
export interface Order {
  id?: string;
  uid: string;
  email: string;
  items: {
    productId: string;
    variantId: string;
    title: string;
    variantName: string;
    price: number;
    qty: number;
    /** Seller slug. Missing on orders placed before the marketplace; treat as "torqline". */
    seller?: string;
  }[];
  /** Distinct sellers in the order. */
  sellers?: string[];
  subtotal: number;
  /** Bundle-offer savings (dollars). Missing on older orders. */
  bundleDiscount?: number;
  /** Discount-code savings (dollars). */
  discount: number;
  shipping: number;
  total: number;
  totalCents: number;
  discountCode: string | null;
  address: OrderAddress;
  status: OrderStatus;
  createdAt: number;
  paidAt?: number;
  amountPaidCents?: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  /** The charge seller transfers are funded from (`source_transaction`). */
  stripeChargeId?: string;
  refundedCents?: number;
  /** Set when the customer opens a card dispute (chargeback). */
  disputed?: boolean;
  /** Set by the webhook when something needs a human (e.g. stock ran out between checkout and payment). */
  needsReview?: string;
}

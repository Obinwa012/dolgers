// Firestore document shapes shared by the website and Cloud Functions.
// Money is always an integer number of cents (USD). Timestamps are epoch milliseconds so the
// same shape works in the browser, on the server and in the search index.

export type Cents = number;
export type Millis = number;

export const DEPARTMENTS = ['men', 'boys'] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** How a product is sized; decides which size labels a vendor can choose from. */
export const SIZE_SYSTEMS = ['alpha', 'eu-shoe', 'age', 'waist', 'one-size'] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** Parent category id, or null for a top-level department. */
  parentId: string | null;
  /** Slugs from the root down, e.g. ['men', 'outerwear', 'coats']. */
  path: string[];
  department: Department | null;
  description: string;
  order: number;
  /** Placeholder tone used until a real tile image is uploaded. */
  tone?: string;
  image?: ProductImage;
}

export type VendorStatus = 'active' | 'suspended';

export interface VendorFacts {
  founded?: string;
  basedIn?: string;
  madeIn?: string;
  shipsFrom?: string;
  /** Working days from order to dispatch, e.g. [2, 4]. */
  dispatchDays?: [number, number];
}

/** Public vendor storefront: `vendors/{vendorId}`. */
export interface Vendor {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  /** Plain text, paragraphs separated by blank lines. Never rendered as HTML. */
  story: string;
  storyTitle?: string;
  banner?: ProductImage;
  storyImage?: ProductImage;
  facts: VendorFacts;
  departments: Department[];
  status: VendorStatus;
  followerCount: number;
  productCount: number;
  createdAt: Millis;
  updatedAt: Millis;
}

/** Private vendor data, readable by Functions only: `vendorPrivate/{vendorId}`. */
export interface VendorPrivate {
  vendorId: string;
  ownerUid: string;
  contactEmail: string;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Platform commission in basis points (1500 = 15%). */
  commissionBps: number;
  /** Products skip admin review when true. */
  autoApprove: boolean;
  updatedAt: Millis;
}

export type VendorRole = 'owner' | 'staff';

export interface VendorMember {
  uid: string;
  email: string;
  role: VendorRole;
  addedAt: Millis;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

/** `vendorApplications/{uid}`: one application per account. */
export interface VendorApplication {
  uid: string;
  email: string;
  businessName: string;
  contactName: string;
  website: string;
  instagram: string;
  description: string;
  departments: Department[];
  shipsFrom: string;
  status: ApplicationStatus;
  reviewNote: string;
  vendorId: string | null;
  createdAt: Millis;
  reviewedAt: Millis | null;
}

export interface ProductImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** CSS gradient used as a placeholder while no photo exists (demo catalog). */
  tone?: string;
}

export interface ProductColour {
  name: string;
  hex: string;
}

export interface Variant {
  sku: string;
  size: string;
  price: Cents;
  compareAtPrice: Cents | null;
}

export const PRODUCT_STATUSES = ['draft', 'in_review', 'live', 'rejected', 'suspended', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** `products/{productId}`. Vendor and brand names are copied in for fast reads. */
export interface Product {
  id: string;
  slug: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  /** The manufacturer/brand (e.g. ROCKBROS). Dolgers is the seller, not the brand. */
  brand?: string;
  /** Overall star rating (e.g. 4.8). From verified buyer reviews. */
  rating?: number;
  department: Department;
  categoryId: string;
  categoryPath: string[];
  title: string;
  description: string;
  composition: string;
  care: string;
  fitNote: string;
  sizeSystem: SizeSystem;
  colour: ProductColour;
  images: ProductImage[];
  variants: Variant[];
  priceMin: Cents;
  priceMax: Cents;
  /** Product ids shown under "Complete the look". */
  related: string[];
  status: ProductStatus;
  reviewNote: string;
  /** Customer reviews for social proof. */
  reviews?: ProductReview[];
  /** Freight data from vetting (method, ETA, cost). */
  shipping?: ProductShipping;
  /** Featured products sort first under "Featured". */
  featured: boolean;
  publishedAt: Millis | null;
  createdAt: Millis;
  updatedAt: Millis;
}

/** A customer review, collected from verified buyers. */
export interface ProductReview {
  stars: number;
  text: string;
  origin?: string;
  size?: string;
}

/** Freight data from supplier API vetting. */
export interface ProductShipping {
  method: string;
  etaDays: string;
  cost: number;
  tracking: boolean;
}

/** `inventory/{sku}`: written by Functions only. */
export interface InventoryRecord {
  sku: string;
  productId: string;
  vendorId: string;
  size: string;
  onHand: number;
  reserved: number;
  updatedAt: Millis;
}

export interface Address {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'US';
  phone: string;
}

export const DELIVERY_METHODS = ['standard', 'express'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export interface OrderLine {
  sku: string;
  productId: string;
  productSlug: string;
  title: string;
  vendorId: string;
  vendorName: string;
  size: string;
  colour: string;
  image: ProductImage | null;
  unitPrice: Cents;
  quantity: number;
  lineTotal: Cents;
}

export interface OrderTotals {
  subtotal: Cents;
  discount: Cents;
  shipping: Cents;
  tax: Cents;
  total: Cents;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'partially_shipped'
  | 'shipped'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded';

/** `orders/{orderId}`. Lines are frozen at the price paid. */
export interface Order {
  id: string;
  number: string;
  uid: string;
  email: string;
  isGuest: boolean;
  lines: OrderLine[];
  vendorIds: string[];
  shippingAddress: Address;
  billingAddress: Address | null;
  delivery: DeliveryMethod;
  totals: OrderTotals;
  /** Each vendor's share of the order discount, in cents. */
  vendorDiscounts: Record<string, Cents>;
  currency: 'usd';
  promoCode: string | null;
  paymentIntentId: string;
  chargeId: string | null;
  taxCalculationId: string | null;
  paymentMethodSummary: string | null;
  /** True while this order holds reserved stock. */
  reservationHeld: boolean;
  status: OrderStatus;
  refundedTotal: Cents;
  reservationExpiresAt: Millis;
  marketingOptIn: boolean;
  createdAt: Millis;
  paidAt: Millis | null;
}

export type VendorOrderStatus = 'awaiting_payment' | 'preparing' | 'shipped' | 'cancelled' | 'refunded';
export type PayoutStatus = 'pending' | 'paid' | 'reversed' | 'blocked';

export interface Tracking {
  carrier: string;
  number: string;
  url: string;
}

/** `vendorOrders/{orderId}_{vendorId}`: one maker's part of an order. */
export interface VendorOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  uid: string;
  email: string;
  lines: OrderLine[];
  shippingAddress: Address;
  delivery: DeliveryMethod;
  subtotal: Cents;
  discountShare: Cents;
  commission: Cents;
  /** What the vendor receives: subtotal - discountShare - commission. */
  vendorNet: Cents;
  refunded: Cents;
  status: VendorOrderStatus;
  tracking: Tracking | null;
  shippedAt: Millis | null;
  estimatedDelivery: { from: Millis; to: Millis } | null;
  payout: { status: PayoutStatus; amount: Cents; transferId: string | null; paidAt: Millis | null };
  createdAt: Millis;
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

/** `returns/{returnId}`. */
export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  vendorOrderId: string;
  vendorId: string;
  uid: string;
  lines: { sku: string; title: string; size: string; quantity: number; unitPrice: Cents }[];
  reason: string;
  status: ReturnStatus;
  note: string;
  refundAmount: Cents;
  createdAt: Millis;
  updatedAt: Millis;
}

export type LedgerType = 'charge' | 'commission' | 'transfer' | 'transfer_reversal' | 'refund' | 'dispute';

/** `ledger/{entryId}`: append-only record of every money movement. */
export interface LedgerEntry {
  id: string;
  type: LedgerType;
  amount: Cents;
  currency: 'usd';
  orderId: string | null;
  vendorId: string | null;
  stripeId: string | null;
  note: string;
  createdAt: Millis;
}

export type PromoType = 'percent' | 'fixed';

/** `promoCodes/{CODE}`: read and written by the server only. */
export interface PromoCode {
  code: string;
  type: PromoType;
  /** Percent (1-100) or cents. */
  value: number;
  minSubtotal: Cents;
  active: boolean;
  startsAt: Millis | null;
  endsAt: Millis | null;
  maxRedemptions: number | null;
  redemptions: number;
  createdAt: Millis;
}

export interface CallToAction {
  label: string;
  href: string;
}

export interface HomeHero {
  eyebrow: string;
  title: string;
  body: string;
  primary: CallToAction;
  secondary: CallToAction;
  image: ProductImage | null;
}

/** `content/home`: editable from the admin console. */
export interface HomeContent {
  announcement: string;
  announcementSlides: string[];
  hero: HomeHero;
  heroSlides: HomeHero[];
  departments: { title: string; body: string; cta: CallToAction; image: ProductImage | null }[];
  edit: {
    eyebrow: string;
    title: string;
    body: string;
    cta: CallToAction;
    image: ProductImage | null;
    productIds: string[];
  };
  newArrivalIds: string[];
  updatedAt: Millis;
}

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  marketingOptIn: boolean;
  createdAt: Millis;
}

export interface SavedAddress extends Address {
  id: string;
  isDefault: boolean;
}

/** Custom claims set by Functions only. */
export interface DolgersClaims {
  admin?: boolean;
  vendorId?: string;
  vendorRole?: VendorRole;
}

export interface AuditEntry {
  id: string;
  actorUid: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: Millis;
}

/** Product as stored in the search index. */
export interface SearchDoc {
  id: string;
  slug: string;
  title: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  department: Department;
  categoryPath: string[];
  categoryLeaf: string;
  colour: string;
  colourHex: string;
  sizes: string[];
  sizesInStock: string[];
  price: Cents;
  priceMax: Cents;
  image: ProductImage | null;
  isNew: boolean;
  featured: boolean;
  publishedAt: Millis;
}

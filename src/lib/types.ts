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
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  brand: string; // brand slug
  category: string; // category slug
  description: string;
  specs: string[];
  image?: string; // optional real photo URL; falls back to generated art
  icon: IconKey;
  tint: string; // hex used for generated art
  variants: Variant[];
  tags: string[]; // "new", "featured", "hot"
  rating: number;
  reviewCount: number;
  stock: number;
  createdAt: number;
}

export interface Category {
  slug: string;
  name: string;
  icon: IconKey;
  tint: string;
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
  }[];
  subtotal: number;
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
  /** Set by the webhook when something needs a human (e.g. stock ran out between checkout and payment). */
  needsReview?: string;
}

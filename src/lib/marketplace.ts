// Marketplace rules shared by the storefront, the seller dashboard and the server.
// Money is in integer cents. Import-free (apart from types) so it can be unit-tested with plain `node`.
import type {
  ApplicationStatus, Category, Order, ReturnStatus, SellerApplication, SellerOrder, Variant, Voltage,
} from "./types.ts";

/** Torqline's own seller slug (first-party stock). */
export const SELF_SELLER = "torqline";
/** Default platform commission on third-party sales. A seller doc can override it. */
export const COMMISSION_RATE = 0.12;
/** Extra days on top of a seller's return window to allow for delivery. */
export const RETURN_TRANSIT_DAYS = 7;

export const VOLTAGES: Voltage[] = ["12V", "18V", "36V", "Corded", "Manual"];

export const sellerOf = (x: { seller?: string }) => x.seller || SELF_SELLER;
export const isMarketplace = (x: { seller?: string }) => sellerOf(x) !== SELF_SELLER;

export class MarketplaceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------------------------
// Order splitting and payouts

type Line = Order["items"][number];

export interface SellerSplit {
  seller: string;
  items: Line[];
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

/**
 * Split an order's items by seller. Discount codes and shipping are Torqline's (the platform funds
 * the discount and keeps shipping), so sellers are paid on their list prices minus commission.
 * First-party lines carry no commission: the whole amount is already Torqline's.
 */
export function splitOrder(items: Line[], rates: Record<string, number | undefined> = {}): SellerSplit[] {
  const by = new Map<string, Line[]>();
  for (const it of items) {
    const s = sellerOf(it);
    by.set(s, [...(by.get(s) ?? []), it]);
  }
  return [...by.entries()].map(([seller, lines]) => {
    const grossCents = lines.reduce((n, l) => n + Math.round(l.price * 100) * l.qty, 0);
    const rate = seller === SELF_SELLER ? 0 : clampRate(rates[seller] ?? COMMISSION_RATE);
    const commissionCents = Math.round(grossCents * rate);
    return { seller, items: lines, grossCents, commissionCents, netCents: grossCents - commissionCents };
  });
}

/** Per-seller fulfilment records for a paid order. Doc ids are `${orderId}_${seller}` (idempotent). */
export function buildSellerOrders(
  order: Pick<Order, "items" | "uid" | "address">,
  orderId: string,
  rates: Record<string, number | undefined>,
  now: number,
): (SellerOrder & { id: string })[] {
  return splitOrder(order.items, rates).map((s) => ({
    id: `${orderId}_${s.seller}`,
    orderId,
    seller: s.seller,
    uid: order.uid,
    items: s.items,
    address: order.address,
    grossCents: s.grossCents,
    commissionCents: s.commissionCents,
    netCents: s.netCents,
    status: "awaiting_shipment",
    payout: s.seller === SELF_SELLER ? "none" : "held",
    createdAt: now,
  }));
}

const clampRate = (r: number) => (Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : COMMISSION_RATE);

/**
 * How much of a seller's transfer to claw back when `refundCents` of their goods is refunded.
 * Proportional to the refunded share of gross, and never more than what's left of the net.
 */
export function reversalCents(so: Pick<SellerOrder, "grossCents" | "netCents">, refundCents: number, alreadyReversedCents = 0) {
  if (so.grossCents <= 0 || refundCents <= 0) return 0;
  const share = Math.round((so.netCents * Math.min(refundCents, so.grossCents)) / so.grossCents);
  return Math.max(0, Math.min(share, so.netCents - alreadyReversedCents));
}

// ---------------------------------------------------------------------------------------------
// Returns and disputes

export type ReturnActor = "customer" | "seller" | "admin";
export type ReturnAction = "approve" | "reject" | "escalate" | "refund" | "deny";

/** Allowed moves in the return workflow. Anything not listed is refused. */
const RETURN_FLOW: Record<ReturnActor, Partial<Record<ReturnAction, { from: ReturnStatus[]; to: ReturnStatus }>>> = {
  seller: {
    approve: { from: ["requested"], to: "approved" },
    reject: { from: ["requested"], to: "rejected" },
  },
  customer: {
    // A customer can escalate a rejection, or a request the seller has sat on (checked by the caller).
    escalate: { from: ["rejected", "requested"], to: "escalated" },
  },
  admin: {
    refund: { from: ["requested", "rejected", "escalated"], to: "resolved_refund" },
    deny: { from: ["requested", "rejected", "escalated"], to: "resolved_denied" },
  },
};

/** Days a seller has to answer a return before the customer may escalate it. */
export const SELLER_RESPONSE_DAYS = 3;
const DAY = 86_400_000;

export function nextReturnStatus(
  current: ReturnStatus,
  actor: ReturnActor,
  action: ReturnAction,
  ctx: { now?: number; createdAt?: number } = {},
): ReturnStatus {
  const rule = RETURN_FLOW[actor][action];
  if (!rule || !rule.from.includes(current)) throw new MarketplaceError(`Can't ${action} a return that is ${current.replace("_", " ")}.`, 409);
  if (actor === "customer" && current === "requested") {
    const waited = (ctx.now ?? 0) - (ctx.createdAt ?? 0);
    if (waited < SELLER_RESPONSE_DAYS * DAY)
      throw new MarketplaceError(`The seller has ${SELLER_RESPONSE_DAYS} days to respond before you can escalate.`, 409);
  }
  return rule.to;
}

/** Whether a refund should be issued when a return enters this status. */
export const refundsOn = (s: ReturnStatus) => s === "approved" || s === "resolved_refund";

/** Last moment a return can be requested for this seller order, or null if it can't be at all. */
export function returnDeadline(so: Pick<SellerOrder, "status" | "shippedAt" | "createdAt">, returnDays: number): number | null {
  if (so.status === "canceled") return null;
  const from = so.shippedAt ?? so.createdAt;
  return from + (returnDays + RETURN_TRANSIT_DAYS) * DAY;
}

export interface ReturnInput {
  productId: string;
  variantId: string;
  qty: number;
  reason: string;
  details: string;
}

export const RETURN_REASONS = [
  "Damaged or defective",
  "Wrong item sent",
  "Not as described",
  "No longer needed",
  "Arrived too late",
] as const;

/**
 * Validate a customer's return request against the seller order it's for.
 * `alreadyReturned` is the quantity of this line in earlier, non-denied return requests.
 */
export function validateReturn(
  body: unknown,
  so: SellerOrder,
  opts: { now: number; returnDays: number; alreadyReturned: number },
): ReturnInput & { amountCents: number; title: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const productId = str(b.productId, 200);
  const variantId = str(b.variantId, 100);
  const qty = b.qty;
  const reason = str(b.reason, 60);
  const details = str(b.details, 1000);
  const line = so.items.find((i) => i.productId === productId && i.variantId === variantId);
  if (!line) throw new MarketplaceError("That item isn't in this order.");
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) throw new MarketplaceError("Choose how many to return.");
  if (qty > line.qty - opts.alreadyReturned)
    throw new MarketplaceError(line.qty - opts.alreadyReturned > 0 ? `You can return at most ${line.qty - opts.alreadyReturned}.` : "Every unit of this item already has a return.");
  if (!(RETURN_REASONS as readonly string[]).includes(reason)) throw new MarketplaceError("Choose a reason.");
  const deadline = returnDeadline(so, opts.returnDays);
  if (deadline === null || opts.now > deadline) throw new MarketplaceError("The return window for this order has closed.", 409);
  return { productId, variantId, qty, reason, details, amountCents: Math.round(line.price * 100) * qty, title: line.title };
}

// ---------------------------------------------------------------------------------------------
// Seller applications and listings

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const BUSINESS_TYPES: SellerApplication["businessType"][] = ["sole_proprietor", "llc", "corporation", "partnership"];

export function validateApplication(
  body: unknown,
  categorySlugs: string[],
): Omit<SellerApplication, "uid" | "email" | "status" | "createdAt"> {
  const b = (body ?? {}) as Record<string, unknown>;
  const out = {
    businessName: str(b.businessName, 80),
    legalName: str(b.legalName, 120),
    businessType: str(b.businessType, 30) as SellerApplication["businessType"],
    country: str(b.country, 2).toUpperCase(),
    website: str(b.website, 200),
    phone: str(b.phone, 30),
    categories: Array.isArray(b.categories) ? b.categories.filter((c): c is string => typeof c === "string" && categorySlugs.includes(c)).slice(0, 20) : [],
    description: str(b.description, 2000),
  };
  if (out.businessName.length < 2) throw new MarketplaceError("Enter your store name.");
  if (out.legalName.length < 2) throw new MarketplaceError("Enter your registered business name.");
  if (!BUSINESS_TYPES.includes(out.businessType)) throw new MarketplaceError("Choose a business type.");
  if (!/^[A-Z]{2}$/.test(out.country)) throw new MarketplaceError("Choose a country.");
  if (out.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(out.website)) throw new MarketplaceError("Website must start with http:// or https://.");
  if (!/^[+\d][\d\s().-]{6,}$/.test(out.phone)) throw new MarketplaceError("Enter a phone number.");
  if (!out.categories.length) throw new MarketplaceError("Choose at least one category you'll sell in.");
  if (out.description.length < 30) throw new MarketplaceError("Tell us a little more about what you sell (30+ characters).");
  return out;
}

export const canReapply = (s: ApplicationStatus | undefined) => s === undefined || s === "rejected";

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export interface ListingInput {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  brand: string;
  voltage?: Voltage;
  specs: string[];
  variants: Variant[];
  stock: number;
}

const money2 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN);

function validateVariants(raw: unknown): Variant[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) throw new MarketplaceError("Add between 1 and 6 options.");
  const seen = new Set<string>();
  return raw.map((r, i) => {
    const v = (r ?? {}) as Record<string, unknown>;
    const name = str(v.name, 60);
    const id = slugify(str(v.id, 40) || name) || `opt-${i + 1}`;
    const price = money2(v.price);
    const compare = v.compareAtPrice === undefined || v.compareAtPrice === null || v.compareAtPrice === "" ? undefined : money2(v.compareAtPrice);
    if (!name) throw new MarketplaceError(`Option ${i + 1} needs a name.`);
    if (seen.has(id)) throw new MarketplaceError(`Two options share the name "${name}".`);
    seen.add(id);
    if (!(price >= 1 && price <= 50_000)) throw new MarketplaceError(`Price for "${name}" must be between $1 and $50,000.`);
    if (compare !== undefined && !(compare > price && compare <= 50_000))
      throw new MarketplaceError(`"Was" price for "${name}" must be higher than the price.`);
    return { id, name, price, ...(compare !== undefined ? { compareAtPrice: compare } : {}), batteryIncluded: v.batteryIncluded === true };
  });
}

function validateStock(v: unknown) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100_000) throw new MarketplaceError("Stock must be a whole number from 0 to 100,000.");
  return v;
}

/** A new listing from a seller. Brand and category must be ones the store already carries. */
export function validateListing(body: unknown, ctx: { categories: Category[]; brandSlugs: string[] }): ListingInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = str(b.title, 150);
  const description = str(b.description, 2000);
  const category = ctx.categories.find((c) => c.slug === str(b.category, 60));
  const subcategory = str(b.subcategory, 60) || undefined;
  const brand = str(b.brand, 60);
  const voltage = (str(b.voltage, 10) || undefined) as Voltage | undefined;
  const specs = Array.isArray(b.specs) ? b.specs.map((s) => str(s, 120)).filter(Boolean).slice(0, 12) : [];
  if (title.length < 10) throw new MarketplaceError("Title must be at least 10 characters.");
  if (description.length < 20) throw new MarketplaceError("Description must be at least 20 characters.");
  if (!category) throw new MarketplaceError("Choose a category.");
  if (subcategory && !category.subcategories?.some((s) => s.slug === subcategory)) throw new MarketplaceError("That subcategory isn't in the chosen category.");
  if (!ctx.brandSlugs.includes(brand)) throw new MarketplaceError("Choose a brand.");
  if (voltage && !VOLTAGES.includes(voltage)) throw new MarketplaceError("Choose a valid voltage.");
  return { title, description, category: category.slug, subcategory, brand, voltage, specs, variants: validateVariants(b.variants), stock: validateStock(b.stock) };
}

/**
 * A price/stock update to an existing listing. Option ids must stay the same (carts and orders
 * reference them); sellers add or remove options by creating a new listing.
 */
export function validateListingUpdate(body: unknown, existing: Variant[]): { variants: Variant[]; stock: number; listingStatus: "active" | "inactive" } {
  const b = (body ?? {}) as Record<string, unknown>;
  // Names can't change here, so fill them from the listing (callers only need to send id + prices).
  const raw = Array.isArray(b.variants)
    ? b.variants.map((r) => {
        const v = (r ?? {}) as Record<string, unknown>;
        return { ...v, name: existing.find((e) => e.id === v.id)?.name ?? v.name };
      })
    : b.variants;
  const variants = validateVariants(raw);
  const ids = (vs: Variant[]) => vs.map((v) => v.id).sort().join("|");
  if (ids(variants) !== ids(existing)) throw new MarketplaceError("Options can't be added or removed here; only prices and stock.");
  const status = b.listingStatus === "inactive" ? "inactive" : "active";
  // Keep each option's name as listed; only money fields change. (No undefined fields: Firestore rejects them.)
  const merged = existing.map((e) => {
    const n = variants.find((v) => v.id === e.id)!;
    const out: Variant = { id: e.id, name: e.name, price: n.price };
    if (n.compareAtPrice !== undefined) out.compareAtPrice = n.compareAtPrice;
    if (e.batteryIncluded !== undefined) out.batteryIncluded = e.batteryIncluded;
    return out;
  });
  return { variants: merged, stock: validateStock(b.stock), listingStatus: status };
}

export const CARRIERS = ["UPS", "FedEx", "USPS", "DHL", "Other"] as const;

export function validateTracking(body: unknown): { carrier: string; trackingNumber: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const carrier = str(b.carrier, 20);
  const trackingNumber = str(b.trackingNumber, 40).replace(/\s+/g, "");
  if (!(CARRIERS as readonly string[]).includes(carrier)) throw new MarketplaceError("Choose a carrier.");
  if (!/^[A-Za-z0-9-]{6,40}$/.test(trackingNumber)) throw new MarketplaceError("Enter a valid tracking number.");
  return { carrier, trackingNumber };
}

export function validateAnswer(body: unknown): { questionId: string; answer: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const questionId = str(b.questionId, 100);
  const answer = str(b.answer, 1000);
  if (!questionId) throw new MarketplaceError("Missing question.");
  if (answer.length < 2) throw new MarketplaceError("Write an answer.");
  return { questionId, answer };
}

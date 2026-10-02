// Storefront helpers: collection filters, delivery estimates, financing and product-page data.
// Import-free (apart from types) so it can be unit-tested with plain `node`.
import type { Product, Seller, SpecRow, Fit } from "./types.ts";

const SELF = "dolgers"; // mirrors SELF_SELLER in marketplace.ts (kept import-free)
const sellerSlug = (p: Product) => p.seller || SELF;
const lowest = (p: Product) => Math.min(...p.variants.map((v) => v.price));

export const isActive = (p: Product) => (p.listingStatus ?? "active") === "active";

// ---------------------------------------------------------------------------------------------
// Collection filters

export interface Filters {
  q: string;
  brand: string;
  sub: string;
  sale: boolean;
  clearance: boolean;
  fit: Fit[];
  inStock: boolean;
  /** "dolgers", "marketplace", or one seller's slug. */
  seller: string;
  min: number | null;
  max: number | null;
}

export const FILTER_KEYS = ["q", "brand", "sub", "sale", "clearance", "fit", "stock", "seller", "min", "max"] as const;

const num = (s: string) => {
  const n = Number(s);
  return s !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Parse URL search params (as plain strings) into filters. Unknown values are dropped. */
export function parseFilters(get: (k: string) => string): Filters {
  const fits: Fit[] = ["Petite", "Regular", "Tall", "Plus"];
  return {
    q: get("q").trim(),
    brand: get("brand"),
    sub: get("sub"),
    sale: get("sale") === "1",
    clearance: get("clearance") === "1",
    fit: get("fit").split(",").filter((v): v is Fit => (fits as string[]).includes(v)),
    inStock: get("stock") === "in",
    seller: get("seller"),
    min: num(get("min")),
    max: num(get("max")),
  };
}

export function filterProducts(list: Product[], f: Filters): Product[] {
  const q = f.q.toLowerCase();
  return list.filter((p) => {
    if (!isActive(p)) return false;
    if (q && !`${p.title} ${p.description} ${p.brand} ${p.category} ${p.subcategory ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.sub && p.subcategory !== f.sub) return false;
    if (f.sale && !p.variants.some((v) => v.compareAtPrice && v.compareAtPrice > v.price)) return false;
    if (f.clearance && !p.tags.includes("clearance")) return false;
    if (f.fit.length && !(p.fit && f.fit.includes(p.fit))) return false;
    if (f.inStock && p.stock <= 0) return false;
    if (f.seller === "dolgers" && sellerSlug(p) !== SELF) return false;
    else if (f.seller === "marketplace" && sellerSlug(p) === SELF) return false;
    else if (f.seller && f.seller !== "dolgers" && f.seller !== "marketplace" && sellerSlug(p) !== f.seller) return false;
    // A product matches a price range if any of its options does.
    if (f.min !== null || f.max !== null) {
      const ok = p.variants.some((v) => (f.min === null || v.price >= f.min) && (f.max === null || v.price <= f.max));
      if (!ok) return false;
    }
    return true;
  });
}

export const PRICE_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under $40", min: null, max: 40 },
  { label: "$40 – $80", min: 40, max: 80 },
  { label: "$80 – $150", min: 80, max: 150 },
  { label: "$150 & up", min: 150, max: null },
];

// ---------------------------------------------------------------------------------------------
// Delivery estimates

/** Orders placed before this hour (store time, weekdays) leave the same day. */
export const CUTOFF_HOUR = 14;
export const STORE_TZ = "America/Chicago";
export const TRANSIT_DAYS = { min: 2, max: 4 };

/** The calendar date and hour in the store's time zone, as a UTC-midnight Date for arithmetic. */
function storeClock(now: Date): { day: Date; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)), hour: +parts.hour };
}

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
/** The date `n` weekdays after `d` (Sat + 1 = Mon). */
function addBusinessDays(d: Date, n: number): Date {
  const out = new Date(d);
  for (let i = 0; i < n; ) {
    out.setUTCDate(out.getUTCDate() + 1);
    if (!isWeekend(out)) i++;
  }
  return out;
}

/**
 * Earliest and latest delivery dates for an in-stock item. Dates are UTC-midnight values of the
 * store's calendar day, so format them with `timeZone: "UTC"`.
 */
export function deliveryWindow(handlingDays: number, now: Date): { from: Date; to: Date } {
  const { day, hour } = storeClock(now);
  const sameDay = !isWeekend(day) && hour < CUTOFF_HOUR;
  const dispatch = addBusinessDays(sameDay ? day : addBusinessDays(day, 1), Math.max(0, handlingDays));
  return { from: addBusinessDays(dispatch, TRANSIT_DAYS.min), to: addBusinessDays(dispatch, TRANSIT_DAYS.max) };
}

export const shortDate = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// ---------------------------------------------------------------------------------------------
// Financing message. PLACEHOLDER: before launch, turn on a pay-over-time method (e.g. Affirm or
// Klarna in the Stripe Dashboard) and make these numbers match that provider's actual terms.

export const FINANCING = { months: 12, minCents: 19_900 };

/** Monthly payment at 0% over FINANCING.months, rounded up to the cent; null below the minimum. */
export function monthlyPaymentCents(priceCents: number): number | null {
  if (priceCents < FINANCING.minCents) return null;
  return Math.ceil(priceCents / FINANCING.months);
}

// ---------------------------------------------------------------------------------------------
// Product page

/** Full specification table: the listing's own table if it has one, otherwise built from highlights. */
export function fullSpecs(p: Product, names: { brand?: string; category?: string; seller?: string }): SpecRow[] {
  const rows: SpecRow[] = [
    { label: "Brand", value: names.brand ?? p.brand },
    { label: "Model / SKU", value: p.slug.toUpperCase() },
  ];
  if (names.category) rows.push({ label: "Category", value: names.category });
  if (p.fit) rows.push({ label: "Fit", value: `${p.fit} sizing` });
  if (p.variants.length > 1) rows.push({ label: "Colours", value: p.variants.map((v) => v.name).join(" · ") });
  if (p.specTable?.length) rows.push(...p.specTable);
  else
    for (const s of p.specs) {
      const i = s.indexOf(":");
      rows.push(i > 0 ? { label: s.slice(0, i).trim(), value: s.slice(i + 1).trim() } : { label: "Feature", value: s });
    }
  if (names.seller) rows.push({ label: "Sold by", value: names.seller });
  return rows;
}

/**
 * "Complete the look": the listing's own picks, else the best-rated in-stock pieces from other
 * categories (a top with trousers, a dress with a coat). Active items only; at most `limit`.
 */
export function boughtTogether(p: Product, all: Product[], limit = 2): Product[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const ok = (x: Product | undefined): x is Product => !!x && x.id !== p.id && isActive(x) && x.stock > 0;
  const picked = (p.boughtTogether ?? []).map((id) => byId.get(id)).filter(ok);
  if (picked.length < limit) {
    const extra = all
      .filter((x) => ok(x) && !picked.includes(x))
      .filter((x) => x.category !== p.category)
      .sort((a, b) => b.rating - a.rating);
    picked.push(...extra);
  }
  return picked.slice(0, limit);
}

/** Up to `limit` close alternatives for a comparison table: same subcategory first, then category. */
export function compareSet(p: Product, all: Product[], limit = 3): Product[] {
  const pool = all.filter((x) => x.id !== p.id && isActive(x) && x.category === p.category);
  const score = (x: Product) => (x.subcategory && x.subcategory === p.subcategory ? 2 : 0) + (x.fit === p.fit ? 1 : 0);
  return pool.sort((a, b) => score(b) - score(a) || Math.abs(lowest(a) - lowest(p)) - Math.abs(lowest(b) - lowest(p))).slice(0, limit);
}

/** Customer-facing sentence on who handles returns and warranty for an item. */
export function policyLines(s: Pick<Seller, "name" | "slug" | "returns" | "returnDays" | "warranty">): { returns: string; warranty: string } {
  const self = s.slug === SELF;
  return {
    returns:
      s.returns === "dolgers"
        ? `${s.returnDays}-day returns handled by Dolgers${self ? "" : ` on behalf of ${s.name}`}.`
        : `${s.returnDays}-day returns handled by ${s.name}. Dolgers steps in if a return isn't resolved.`,
    warranty:
      s.warranty === "manufacturer"
        ? "Faulty or misdescribed items are covered by the brand; we'll help you make a claim."
        : `Quality claims are handled by ${s.name}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Card helpers

/** "18k+ paid" style sales figure for product cards. */
export function soldLabel(p: Pick<Product, "sold" | "reviewCount">): string {
  const n = p.sold ?? p.reviewCount * 38;
  if (n >= 10_000) return `${Math.floor(n / 1000)}k+ sold`;
  if (n >= 1_000) return `${Math.floor(n / 100) / 10}k+ sold`;
  return `${Math.max(1, Math.floor(n / 10) * 10)}+ sold`;
}

/** Whole dollars and the cents part ("" when .00), for Taobao-style price display. */
export function splitPrice(n: number): { whole: string; cents: string } {
  const c = Math.round(n * 100) % 100;
  return { whole: String(Math.floor(Math.round(n * 100) / 100)), cents: c ? `.${String(c).padStart(2, "0")}` : "" };
}

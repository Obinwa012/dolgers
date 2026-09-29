// Storefront helpers: collection filters, delivery estimates, financing and product-page data.
// Import-free (apart from types) so it can be unit-tested with plain `node`.
import type { Product, Seller, SpecRow, Voltage } from "./types.ts";

const SELF = "torqline"; // mirrors SELF_SELLER in marketplace.ts (kept import-free)
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
  voltage: Voltage[];
  battery: boolean;
  inStock: boolean;
  /** "torqline", "marketplace", or one seller's slug. */
  seller: string;
  min: number | null;
  max: number | null;
}

export const FILTER_KEYS = ["q", "brand", "sub", "sale", "clearance", "voltage", "battery", "stock", "seller", "min", "max"] as const;

const num = (s: string) => {
  const n = Number(s);
  return s !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Parse URL search params (as plain strings) into filters. Unknown values are dropped. */
export function parseFilters(get: (k: string) => string): Filters {
  const voltages: Voltage[] = ["12V", "18V", "36V", "Corded", "Manual"];
  return {
    q: get("q").trim(),
    brand: get("brand"),
    sub: get("sub"),
    sale: get("sale") === "1",
    clearance: get("clearance") === "1",
    voltage: get("voltage").split(",").filter((v): v is Voltage => (voltages as string[]).includes(v)),
    battery: get("battery") === "1",
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
    if (f.voltage.length && !(p.voltage && f.voltage.includes(p.voltage))) return false;
    if (f.battery && !p.variants.some((v) => v.batteryIncluded)) return false;
    if (f.inStock && p.stock <= 0) return false;
    if (f.seller === "torqline" && sellerSlug(p) !== SELF) return false;
    else if (f.seller === "marketplace" && sellerSlug(p) === SELF) return false;
    else if (f.seller && f.seller !== "torqline" && f.seller !== "marketplace" && sellerSlug(p) !== f.seller) return false;
    // A product matches a price range if any of its options does.
    if (f.min !== null || f.max !== null) {
      const ok = p.variants.some((v) => (f.min === null || v.price >= f.min) && (f.max === null || v.price <= f.max));
      if (!ok) return false;
    }
    return true;
  });
}

export const PRICE_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under $50", min: null, max: 50 },
  { label: "$50 – $150", min: 50, max: 150 },
  { label: "$150 – $300", min: 150, max: 300 },
  { label: "$300 & up", min: 300, max: null },
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
  if (p.voltage) rows.push({ label: "Power source", value: p.voltage === "Manual" ? "None (hand tool)" : p.voltage === "Corded" ? "Corded (mains)" : `${p.voltage} battery platform` });
  if (p.variants.length > 1 || p.variants[0]?.batteryIncluded !== undefined)
    rows.push({ label: "Battery included", value: p.variants.map((v) => `${v.name}: ${v.batteryIncluded ? "Yes" : "No"}`).join(" · ") });
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
 * "Frequently bought together": the listing's own picks, else batteries/chargers and accessories on
 * the same platform. In-stock, active items only; at most `limit`.
 */
export function boughtTogether(p: Product, all: Product[], limit = 2): Product[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const ok = (x: Product | undefined): x is Product => !!x && x.id !== p.id && isActive(x) && x.stock > 0;
  const picked = (p.boughtTogether ?? []).map((id) => byId.get(id)).filter(ok);
  if (picked.length < limit) {
    const extra = all
      .filter((x) => ok(x) && !picked.includes(x))
      .filter((x) => (x.category === "power-supplies" && p.voltage && x.voltage === p.voltage) || x.category === "accessories")
      .sort((a, b) => b.rating - a.rating);
    picked.push(...extra);
  }
  return picked.slice(0, limit);
}

/** Up to `limit` close alternatives for a comparison table: same subcategory first, then category. */
export function compareSet(p: Product, all: Product[], limit = 3): Product[] {
  const pool = all.filter((x) => x.id !== p.id && isActive(x) && x.category === p.category);
  const score = (x: Product) => (x.subcategory && x.subcategory === p.subcategory ? 2 : 0) + (x.voltage === p.voltage ? 1 : 0);
  return pool.sort((a, b) => score(b) - score(a) || Math.abs(lowest(a) - lowest(p)) - Math.abs(lowest(b) - lowest(p))).slice(0, limit);
}

/** Customer-facing sentence on who handles returns and warranty for an item. */
export function policyLines(s: Pick<Seller, "name" | "slug" | "returns" | "returnDays" | "warranty">): { returns: string; warranty: string } {
  const self = s.slug === SELF;
  return {
    returns:
      s.returns === "torqline"
        ? `${s.returnDays}-day returns handled by Torqline${self ? "" : ` on behalf of ${s.name}`}.`
        : `${s.returnDays}-day returns handled by ${s.name}. Torqline steps in if a return isn't resolved.`,
    warranty:
      s.warranty === "manufacturer"
        ? "Warranty claims go to the manufacturer; we'll help you file one."
        : `Warranty service is provided by ${s.name}.`,
  };
}

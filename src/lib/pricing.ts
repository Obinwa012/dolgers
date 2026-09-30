// Pricing rules shared by the browser (display) and the server (what is actually charged).
// All arithmetic is in integer cents so the two can never drift by a rounding error.
// Import-free on purpose so it can be unit-tested with plain `node`.

export const CURRENCY = "usd";
export const FREE_SHIPPING_CENTS = 9_900;
export const SHIPPING_FEE_CENTS = 1_200;
/** Dollars, for copy like "Free shipping over $99". */
export const FREE_SHIPPING = FREE_SHIPPING_CENTS / 100;

export interface DiscountRule {
  percentOff: number;
  /** Only valid when the customer has no earlier paid order. */
  firstOrderOnly: boolean;
}

export const DISCOUNT_CODES: Record<string, DiscountRule> = {
  FIRSTBUILD: { percentOff: 5, firstOrderOnly: true },
};

export const normalizeCode = (code: string | null | undefined) => (code ?? "").trim().toUpperCase();
export const toCents = (dollars: number) => Math.round(dollars * 100);

/**
 * Bundle offers: buy every item in the set together and get `percentOff` those items.
 * Dolgers-sold items only, so the platform funds the discount and seller payouts are unaffected.
 */
export interface Bundle {
  id: string;
  title: string;
  blurb: string;
  items: { productId: string; variantId: string }[];
  percentOff: number;
}

export const BUNDLES: Bundle[] = [
  {
    id: "jigsaw-power-pack",
    title: "Jigsaw power pack",
    blurb: "JS18 jigsaw, a 5.0Ah twin pack and a rapid charger: everything to start cutting.",
    items: [
      { productId: "voltra-js18-brushless-jigsaw", variantId: "tool" },
      { productId: "voltra-5ah-battery-twin", variantId: "std" },
      { productId: "brunn-dual-port-rapid-charger", variantId: "std" },
    ],
    percentOff: 10,
  },
  {
    id: "compact-drill-starter",
    title: "Compact drill starter set",
    blurb: "The VX12 kit plus a stackable case system to keep it all together.",
    items: [
      { productId: "voltra-vx12-compact-drill-driver", variantId: "kit" },
      { productId: "axelwood-stackable-case-system", variantId: "std" },
    ],
    percentOff: 10,
  },
  {
    id: "power-up",
    title: "Power-up pair",
    blurb: "Twin 5.0Ah batteries and the dual-port charger that fills both at once.",
    items: [
      { productId: "voltra-5ah-battery-twin", variantId: "std" },
      { productId: "brunn-dual-port-rapid-charger", variantId: "std" },
    ],
    percentOff: 15,
  },
];

export interface PricedLine {
  unitCents: number;
  qty: number;
  /** Needed to detect bundles; lines without ids never match one. */
  productId?: string;
  variantId?: string;
}

export interface Quote {
  subtotalCents: number;
  /** Bundle savings. */
  bundleCents: number;
  /** Discount-code savings (applied after bundles). */
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  code: string | null;
  bundles: { id: string; sets: number; cents: number }[];
}

/**
 * Bundle savings for a cart. Each unit counts towards at most one bundle; bundles are tried in
 * order of biggest saving per set, so the customer gets the best combination for simple carts.
 */
export function bundleSavings(lines: PricedLine[]): Quote["bundles"] {
  const left = new Map<string, number>();
  const price = new Map<string, number>();
  for (const l of lines) {
    if (!l.productId || !l.variantId) continue;
    const k = `${l.productId}\u0000${l.variantId}`;
    left.set(k, (left.get(k) ?? 0) + l.qty);
    price.set(k, l.unitCents);
  }
  const key = (i: Bundle["items"][number]) => `${i.productId}\u0000${i.variantId}`;
  const perSet = (b: Bundle) =>
    b.items.every((i) => price.has(key(i)))
      ? Math.round((b.items.reduce((n, i) => n + price.get(key(i))!, 0) * b.percentOff) / 100)
      : 0;
  const out: Quote["bundles"] = [];
  for (const b of [...BUNDLES].sort((x, y) => perSet(y) - perSet(x))) {
    const each = perSet(b);
    if (!each) continue;
    const sets = Math.min(...b.items.map((i) => left.get(key(i)) ?? 0));
    if (sets < 1) continue;
    for (const i of b.items) left.set(key(i), left.get(key(i))! - sets);
    out.push({ id: b.id, sets, cents: each * sets });
  }
  return out;
}

/**
 * Totals for a cart. `code` must already be validated (exists, and eligible for this customer);
 * unknown codes are ignored here rather than throwing so the UI can call this freely.
 */
export function quote(lines: PricedLine[], code?: string | null): Quote {
  const subtotalCents = lines.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const bundles = bundleSavings(lines);
  const bundleCents = bundles.reduce((n, b) => n + b.cents, 0);
  const c = normalizeCode(code);
  const rule = c ? DISCOUNT_CODES[c] : undefined;
  const discountCents = rule ? Math.round(((subtotalCents - bundleCents) * rule.percentOff) / 100) : 0;
  const afterDiscount = subtotalCents - bundleCents - discountCents;
  const shippingCents = subtotalCents === 0 || afterDiscount >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_FEE_CENTS;
  return {
    subtotalCents,
    bundleCents,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
    code: rule ? c : null,
    bundles,
  };
}

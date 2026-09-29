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

export interface PricedLine {
  unitCents: number;
  qty: number;
}

export interface Quote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  code: string | null;
}

/**
 * Totals for a cart. `code` must already be validated (exists, and eligible for this customer);
 * unknown codes are ignored here rather than throwing so the UI can call this freely.
 */
export function quote(lines: PricedLine[], code?: string | null): Quote {
  const subtotalCents = lines.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const c = normalizeCode(code);
  const rule = c ? DISCOUNT_CODES[c] : undefined;
  const discountCents = rule ? Math.round((subtotalCents * rule.percentOff) / 100) : 0;
  const afterDiscount = subtotalCents - discountCents;
  const shippingCents = subtotalCents === 0 || afterDiscount >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_FEE_CENTS;
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
    code: rule ? c : null,
  };
}

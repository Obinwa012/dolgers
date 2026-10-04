import { DELIVERY, MAX_LINE_QUANTITY } from './constants.ts';
import { allocate, bps } from './money.ts';
import type { Cents, DeliveryMethod, Millis, OrderLine, OrderTotals, Product, PromoCode } from './types.ts';

export interface CartLineInput {
  sku: string;
  quantity: number;
}

export type LineProblem = 'unavailable' | 'insufficient_stock';

export interface PricedCart {
  lines: OrderLine[];
  problems: { sku: string; problem: LineProblem; available: number }[];
  totals: OrderTotals;
  promo: { code: string; applied: boolean; message: string } | null;
  vendors: { vendorId: string; vendorName: string; subtotal: Cents; discountShare: Cents }[];
}

/**
 * Prices a cart from catalog data. Never trusts client prices: the caller passes products read
 * from the database, and only SKUs and quantities come from the buyer.
 * `stock` maps SKU to units available to sell (on hand minus reserved).
 */
export function priceCart(args: {
  lines: CartLineInput[];
  products: Map<string, Product>;
  stock: Map<string, number>;
  delivery: DeliveryMethod;
  promo: PromoCode | null;
  promoCodeInput?: string | null;
  tax?: Cents;
  now: Millis;
}): PricedCart {
  const bySku = new Map<string, { product: Product; variantIndex: number }>();
  for (const product of args.products.values()) {
    product.variants.forEach((v, variantIndex) => bySku.set(v.sku, { product, variantIndex }));
  }

  // Merge duplicate SKUs so a buyer cannot dodge stock checks by splitting lines.
  const merged = new Map<string, number>();
  for (const line of args.lines) {
    merged.set(line.sku, Math.min(MAX_LINE_QUANTITY, (merged.get(line.sku) ?? 0) + line.quantity));
  }

  const lines: OrderLine[] = [];
  const problems: PricedCart['problems'] = [];
  for (const [sku, quantity] of merged) {
    const hit = bySku.get(sku);
    if (!hit || hit.product.status !== 'live') {
      problems.push({ sku, problem: 'unavailable', available: 0 });
      continue;
    }
    const available = args.stock.get(sku) ?? 0;
    if (available < quantity) {
      problems.push({ sku, problem: 'insufficient_stock', available });
      continue;
    }
    const { product } = hit;
    const variant = product.variants[hit.variantIndex];
    lines.push({
      sku,
      productId: product.id,
      productSlug: product.slug,
      title: product.title,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      size: variant.size,
      colour: product.colour.name,
      image: product.images[0] ?? null,
      unitPrice: variant.price,
      quantity,
      lineTotal: variant.price * quantity,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let discount = 0;
  let promo: PricedCart['promo'] = null;
  const codeInput = args.promoCodeInput?.trim().toUpperCase() || null;
  if (codeInput) {
    const check = checkPromo(args.promo, codeInput, subtotal, args.now);
    promo = { code: codeInput, applied: check.ok, message: check.message };
    if (check.ok && args.promo) {
      discount = args.promo.type === 'percent' ? bps(subtotal, args.promo.value * 100) : args.promo.value;
      discount = Math.min(discount, subtotal);
    }
  }

  const shipping = lines.length ? DELIVERY[args.delivery].price : 0;
  const tax = args.tax ?? 0;

  const vendorOrder: string[] = [];
  const vendorTotals = new Map<string, { vendorName: string; subtotal: Cents }>();
  for (const l of lines) {
    const v = vendorTotals.get(l.vendorId);
    if (v) v.subtotal += l.lineTotal;
    else {
      vendorOrder.push(l.vendorId);
      vendorTotals.set(l.vendorId, { vendorName: l.vendorName, subtotal: l.lineTotal });
    }
  }
  const shares = allocate(discount, vendorOrder.map((id) => vendorTotals.get(id)!.subtotal));
  const vendors = vendorOrder.map((vendorId, i) => ({
    vendorId,
    vendorName: vendorTotals.get(vendorId)!.vendorName,
    subtotal: vendorTotals.get(vendorId)!.subtotal,
    discountShare: shares[i],
  }));

  return {
    lines,
    problems,
    totals: { subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax },
    promo,
    vendors,
  };
}

export function checkPromo(
  promo: PromoCode | null,
  code: string,
  subtotal: Cents,
  now: Millis,
): { ok: boolean; message: string } {
  if (!promo || promo.code !== code || !promo.active) return { ok: false, message: 'This code is not valid.' };
  if (promo.startsAt && now < promo.startsAt) return { ok: false, message: 'This code is not active yet.' };
  if (promo.endsAt && now > promo.endsAt) return { ok: false, message: 'This code has expired.' };
  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
    return { ok: false, message: 'This code has been fully redeemed.' };
  }
  if (subtotal < promo.minSubtotal) {
    return { ok: false, message: `This code needs a subtotal of at least $${Math.ceil(promo.minSubtotal / 100)}.` };
  }
  return { ok: true, message: promo.type === 'percent' ? `${promo.value}% off applied.` : 'Discount applied.' };
}

/** Commission and net payout for one vendor's share of an order. */
export function vendorSettlement(subtotal: Cents, discountShare: Cents, commissionBps: number) {
  const base = Math.max(0, subtotal - discountShare);
  const commission = bps(base, commissionBps);
  return { commission, vendorNet: base - commission };
}

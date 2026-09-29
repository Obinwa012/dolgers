// Pure checkout logic: request validation and server-side pricing.
// No Firebase or Stripe imports, so it can be unit-tested with plain `node` (see scripts/test-checkout.ts).
import { DISCOUNT_CODES, normalizeCode, quote, toCents } from "../pricing.ts";
import type { Order, OrderAddress, Product } from "../types.ts";

export const MAX_LINES = 50;
export const MAX_QTY = 99;

export interface CheckoutRequest {
  items: { productId: string; variantId: string; qty: number }[];
  code: string | null;
  address: OrderAddress;
}

export class CheckoutError extends Error {
  status: number;
  // (No constructor parameter properties: Node's built-in type stripping can't run them.)
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validate the untrusted JSON body. Only ids and quantities are accepted: never prices. */
export function parseCheckoutRequest(body: unknown): CheckoutRequest {
  if (!body || typeof body !== "object") throw new CheckoutError("Invalid request.");
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.items) || b.items.length === 0) throw new CheckoutError("Your cart is empty.");
  if (b.items.length > MAX_LINES) throw new CheckoutError("Too many items in one order.");

  // Merge duplicate lines so a split cart can't dodge per-line quantity limits.
  const merged = new Map<string, { productId: string; variantId: string; qty: number }>();
  for (const raw of b.items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const productId = str(it.productId, 200);
    const variantId = str(it.variantId, 100);
    const qty = it.qty;
    if (!productId || !variantId || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1)
      throw new CheckoutError("Invalid cart item.");
    const key = `${productId}\u0000${variantId}`;
    const prev = merged.get(key);
    merged.set(key, { productId, variantId, qty: (prev?.qty ?? 0) + qty });
  }
  const items = [...merged.values()];
  if (items.some((i) => i.qty > MAX_QTY)) throw new CheckoutError(`Maximum ${MAX_QTY} of any one item.`);

  const a = (b.address ?? {}) as Record<string, unknown>;
  const address: OrderAddress = {
    name: str(a.name, 120),
    line1: str(a.line1, 200),
    city: str(a.city, 100),
    postcode: str(a.postcode, 20),
    country: str(a.country, 60),
  };
  if (Object.values(address).some((v) => !v)) throw new CheckoutError("Please complete your shipping address.");

  const code = normalizeCode(typeof b.code === "string" ? b.code : "") || null;
  return { items, code, address };
}

export interface BuildOrderInput {
  req: CheckoutRequest;
  products: Map<string, Product>;
  uid: string;
  email: string;
  /** Whether the customer already has a paid order (for first-order-only codes). */
  hasPaidOrder: boolean;
  now: number;
}

/** Price the order from catalog data the server trusts. Throws CheckoutError on any problem. */
export function buildOrder({ req, products, uid, email, hasPaidOrder, now }: BuildOrderInput): Order {
  const items: Order["items"] = [];
  const lines: { unitCents: number; qty: number }[] = [];

  // Stock is tracked per product, so count every variant of a product against it.
  const qtyByProduct = new Map<string, number>();
  for (const it of req.items) qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.qty);

  for (const it of req.items) {
    const p = products.get(it.productId);
    const v = p?.variants.find((x) => x.id === it.variantId);
    if (!p || !v) throw new CheckoutError("An item in your cart is no longer available. Please review your cart.", 409);
    const wanted = qtyByProduct.get(p.id) ?? it.qty;
    if (typeof p.stock === "number" && wanted > p.stock)
      throw new CheckoutError(
        p.stock > 0 ? `Only ${p.stock} of "${p.title}" left in stock.` : `"${p.title}" is out of stock.`,
        409,
      );
    const unitCents = toCents(v.price);
    lines.push({ unitCents, qty: it.qty });
    items.push({ productId: p.id, variantId: v.id, title: p.title, variantName: v.name, price: unitCents / 100, qty: it.qty });
  }

  if (req.code) {
    const rule = DISCOUNT_CODES[req.code];
    if (!rule) throw new CheckoutError("That discount code isn't valid.");
    if (rule.firstOrderOnly && hasPaidOrder) throw new CheckoutError(`${req.code} is only valid on your first order.`);
  }

  const q = quote(lines, req.code);
  return {
    uid,
    email,
    items,
    subtotal: q.subtotalCents / 100,
    discount: q.discountCents / 100,
    shipping: q.shippingCents / 100,
    total: q.totalCents / 100,
    totalCents: q.totalCents,
    discountCode: q.code,
    address: req.address,
    status: "pending_payment",
    createdAt: now,
  };
}

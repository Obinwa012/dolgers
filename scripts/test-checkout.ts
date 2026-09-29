// Unit tests for server-side checkout pricing/validation. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { products as catalog } from "../src/data/catalog.ts";
import { quote } from "../src/lib/pricing.ts";
import { buildOrder, CheckoutError, parseCheckoutRequest } from "../src/lib/server/checkout-core.ts";

const address = { name: "A B", line1: "1 Main St", city: "Austin", postcode: "78702", country: "US" };
const products = new Map(catalog.map((p) => [p.id, p]));
const base = { products, uid: "u1", email: "a@b.co", hasPaidOrder: false, now: 1 };
const build = (body: unknown, extra: Partial<typeof base> = {}) =>
  buildOrder({ ...base, ...extra, req: parseCheckoutRequest(body) });

test("prices come from the catalog, never the request", () => {
  const o = build({
    items: [{ productId: "brunn-bn18-brad-nailer", variantId: "std", qty: 2, price: 0.01 }],
    address,
    total: 0,
  });
  assert.equal(o.subtotal, 298);
  assert.equal(o.items[0].price, 149);
  assert.equal(o.shipping, 0); // over $99
  assert.equal(o.totalCents, 29_800);
  assert.equal(o.status, "pending_payment");
});

test("shipping applies under the free threshold (after discount)", () => {
  const hammer = build({ items: [{ productId: "axelwood-claw-hammer-20oz", variantId: "std", qty: 1 }], address });
  assert.equal(hammer.totalCents, 3_900 + 1_200);
  // $99 trimmer: exactly at threshold, free. With 5% off it drops below, so shipping returns.
  const t = { items: [{ productId: "norrmark-gt40-grass-trimmer", variantId: "tool", qty: 1 }], address };
  assert.equal(build(t).shipping, 0);
  const d = build({ ...t, code: "firstbuild" });
  assert.equal(d.discountCode, "FIRSTBUILD");
  assert.equal(d.discount, 4.95);
  assert.equal(d.shipping, 12);
  assert.equal(d.totalCents, 9_900 - 495 + 1_200);
});

test("first-order code is refused for repeat customers", () => {
  const body = { items: [{ productId: "brunn-bn18-brad-nailer", variantId: "std", qty: 1 }], address, code: "FIRSTBUILD" };
  assert.throws(() => build(body, { hasPaidOrder: true }), /first order/);
  assert.throws(() => build({ ...body, code: "FREE100" }), /isn't valid/);
});

test("unknown products/variants and stock limits are rejected", () => {
  assert.throws(() => build({ items: [{ productId: "nope", variantId: "std", qty: 1 }], address }), CheckoutError);
  assert.throws(() => build({ items: [{ productId: "brunn-bn18-brad-nailer", variantId: "gold", qty: 1 }], address }), CheckoutError);
  const p = catalog.find((x) => x.variants.length > 1)!;
  // Two variants of one product both count against that product's stock.
  const half = Math.ceil((p.stock + 1) / 2);
  assert.throws(
    () => build({ items: p.variants.slice(0, 2).map((v) => ({ productId: p.id, variantId: v.id, qty: half })), address }),
    /left in stock|out of stock/,
  );
});

test("request validation", () => {
  const item = { productId: "brunn-bn18-brad-nailer", variantId: "std", qty: 1 };
  assert.throws(() => parseCheckoutRequest(null), CheckoutError);
  assert.throws(() => parseCheckoutRequest({ items: [], address }), /empty/);
  for (const qty of [0, -1, 1.5, "2", 100])
    assert.throws(() => parseCheckoutRequest({ items: [{ ...item, qty }], address }), CheckoutError, `qty ${qty}`);
  assert.throws(() => parseCheckoutRequest({ items: [item], address: { ...address, city: " " } }), /address/);
  // Duplicate lines are merged, so 60 + 60 can't dodge the 99 cap.
  assert.throws(() => parseCheckoutRequest({ items: [{ ...item, qty: 60 }, { ...item, qty: 60 }], address }), /Maximum/);
  assert.equal(parseCheckoutRequest({ items: [item, item], address }).items[0].qty, 2);
});

test("quote() math is exact in cents", () => {
  assert.deepEqual(quote([]), { subtotalCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0, code: null });
  const q = quote([{ unitCents: 1_999, qty: 3 }], "FIRSTBUILD");
  assert.equal(q.subtotalCents, 5_997);
  assert.equal(q.discountCents, 300); // 299.85 rounds to 300
  assert.equal(q.totalCents, 5_997 - 300 + 1_200);
});

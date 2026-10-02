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
    items: [{ productId: "lunette-little-black-dress", variantId: "black", qty: 2, price: 0.01 }],
    address,
    total: 0,
  });
  assert.equal(o.subtotal, 170);
  assert.equal(o.items[0].price, 85);
  assert.equal(o.shipping, 0); // over $99
  assert.equal(o.totalCents, 17_000);
  assert.equal(o.status, "pending_payment");
});

test("shipping applies under the free threshold (after discount)", () => {
  const shorts = build({ items: [{ productId: "sorella-linen-drawstring-shorts", variantId: "aqua", qty: 1 }], address });
  assert.equal(shorts.totalCents, 3_400 + 1_200);
  // Three pairs of shorts ($102) clear the threshold. With 5% off they drop below, so shipping returns.
  const t = { items: [{ productId: "sorella-linen-drawstring-shorts", variantId: "aqua", qty: 3 }], address };
  assert.equal(build(t).shipping, 0);
  const d = build({ ...t, code: "firstlook" });
  assert.equal(d.discountCode, "FIRSTLOOK");
  assert.equal(d.discount, 5.1);
  assert.equal(d.shipping, 12);
  assert.equal(d.totalCents, 10_200 - 510 + 1_200);
});

test("first-order code is refused for repeat customers", () => {
  const body = { items: [{ productId: "lunette-little-black-dress", variantId: "black", qty: 1 }], address, code: "FIRSTLOOK" };
  assert.throws(() => build(body, { hasPaidOrder: true }), /first order/);
  assert.throws(() => build({ ...body, code: "FREE100" }), /isn't valid/);
});

test("unknown products/variants and stock limits are rejected", () => {
  assert.throws(() => build({ items: [{ productId: "nope", variantId: "std", qty: 1 }], address }), CheckoutError);
  assert.throws(() => build({ items: [{ productId: "lunette-little-black-dress", variantId: "gold", qty: 1 }], address }), CheckoutError);
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
  assert.deepEqual(quote([]), {
    subtotalCents: 0, bundleCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0, code: null, bundles: [],
  });
  const q = quote([{ unitCents: 1_999, qty: 3 }], "FIRSTLOOK");
  assert.equal(q.subtotalCents, 5_997);
  assert.equal(q.discountCents, 300); // 299.85 rounds to 300
  assert.equal(q.totalCents, 5_997 - 300 + 1_200);
});

test("bundle offers: applied server-side, once per unit, before the code", () => {
  const line = (productId: string, variantId: string, qty = 1) => ({ productId, variantId, qty });
  // Jeans (68) + tee 3-pack (36) + blazer (96) = 200 → 10% = 20.00.
  const denim = build({
    items: [line("nomi-high-waist-straight-jeans", "mid"), line("sorella-ribbed-cotton-tee-3pack", "neutrals"), line("marlowe-relaxed-linen-blazer", "slate")],
    address,
  });
  assert.equal(denim.bundleDiscount, 20);
  assert.equal(denim.totalCents, 20_000 - 2_000);
  // Dress and layer (dress 58 + blazer 96 = 154 → 10% = 15.40) overlaps the denim outfit on the
  // blazer; the bigger saving wins and each unit is only counted once.
  const both = build({
    items: [line("nomi-high-waist-straight-jeans", "mid"), line("sorella-ribbed-cotton-tee-3pack", "neutrals"), line("marlowe-relaxed-linen-blazer", "slate"), line("aurelia-floral-wrap-midi-dress", "rose")],
    address,
  });
  assert.equal(both.bundleDiscount, 20);
  // Wrong wash (dark jeans) → no denim outfit, but dress and layer still applies.
  const layer = build({
    items: [line("nomi-high-waist-straight-jeans", "dark"), line("marlowe-relaxed-linen-blazer", "slate"), line("aurelia-floral-wrap-midi-dress", "rose")],
    address,
  });
  assert.equal(layer.bundleDiscount, 15.4);
  // Two studio pairs from 2 leggings + 3 bras; the code applies to the post-bundle subtotal.
  const two = build({ items: [line("velvet-high-rise-leggings", "black", 2), line("velvet-longline-sports-bra", "black", 3)], address, code: "FIRSTLOOK" });
  assert.equal(two.bundleDiscount, 22.8);
  const sub = 2 * 4_200 + 3 * 3_400;
  assert.equal(two.discount, Math.round((sub - 2_280) * 0.05) / 100);
  assert.equal(two.totalCents, sub - 2_280 - Math.round((sub - 2_280) * 0.05));
  // Bundle savings can pull an order under the free-shipping threshold.
  const q = quote([{ unitCents: 5_000, qty: 1, productId: "velvet-high-rise-leggings", variantId: "black" }, { unitCents: 5_000, qty: 1, productId: "velvet-longline-sports-bra", variantId: "black" }]);
  assert.equal(q.bundleCents, 1_500);
  assert.equal(q.shippingCents, 1_200);
});

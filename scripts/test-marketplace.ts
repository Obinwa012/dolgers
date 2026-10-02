// Unit tests for marketplace rules and storefront helpers. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { categories, products as catalog, sellers } from "../src/data/catalog.ts";
import {
  buildSellerOrders, COMMISSION_RATE, MarketplaceError, nextReturnStatus, returnDeadline, reversalCents,
  splitOrder, validateApplication, validateListing, validateListingUpdate, validateReturn, validateTracking,
} from "../src/lib/marketplace.ts";
import { buildOrder, parseCheckoutRequest } from "../src/lib/server/checkout-core.ts";
import {
  boughtTogether, compareSet, deliveryWindow, filterProducts, fullSpecs, monthlyPaymentCents, parseFilters, policyLines, shortDate,
} from "../src/lib/shopping.ts";
import type { Product, SellerOrder } from "../src/lib/types.ts";

const DAY = 86_400_000;
const byId = new Map(catalog.map((p) => [p.id, p]));
const address = { name: "A B", line1: "1 Main St", city: "Austin", postcode: "78702", country: "US" };
const filters = (q: Record<string, string>) => parseFilters((k) => q[k] ?? "");

// --- catalog integrity -------------------------------------------------------------------------

test("every product references a real seller, category and subcategory", () => {
  const sellerSlugs = new Set(sellers.map((s) => s.slug));
  for (const p of catalog) {
    if (p.seller) assert.ok(sellerSlugs.has(p.seller), `${p.slug} seller ${p.seller}`);
    const cat = categories.find((c) => c.slug === p.category);
    assert.ok(cat, `${p.slug} category`);
    if (p.subcategory) assert.ok(cat.subcategories?.some((s) => s.slug === p.subcategory), `${p.slug} subcategory ${p.subcategory}`);
    for (const id of p.boughtTogether ?? []) assert.ok(byId.has(id), `${p.slug} boughtTogether ${id}`);
  }
});

// --- checkout carries seller info --------------------------------------------------------------

test("orders record each line's seller; inactive listings can't be bought", () => {
  const o = buildOrder({
    req: parseCheckoutRequest({
      items: [
        { productId: "marlowe-pleated-wide-leg-trousers", variantId: "charcoal", qty: 1 },
        { productId: "willow-cashmere-blend-crewneck", variantId: "camel", qty: 1 },
      ],
      address,
    }),
    products: byId,
    uid: "u1", email: "a@b.co", hasPaidOrder: false, now: 1,
  });
  assert.deepEqual(o.items.map((i) => i.seller), ["dolgers", "willow-and-thread"]);
  assert.deepEqual(o.sellers, ["dolgers", "willow-and-thread"]);

  const inactive = new Map(byId);
  inactive.set("marlowe-pleated-wide-leg-trousers", { ...byId.get("marlowe-pleated-wide-leg-trousers")!, listingStatus: "inactive" });
  assert.throws(
    () => buildOrder({ req: parseCheckoutRequest({ items: [{ productId: "marlowe-pleated-wide-leg-trousers", variantId: "charcoal", qty: 1 }], address }), products: inactive, uid: "u", email: "", hasPaidOrder: false, now: 1 }),
    /no longer available/,
  );
});

// --- payouts -----------------------------------------------------------------------------------

test("order split: commission on third-party lines only, exact cents", () => {
  const items = [
    { productId: "a", variantId: "x", title: "A", variantName: "", price: 149, qty: 2 },
    { productId: "b", variantId: "x", title: "B", variantName: "", price: 119.99, qty: 3, seller: "atelier-rose" },
    { productId: "c", variantId: "x", title: "C", variantName: "", price: 10.01, qty: 1, seller: "maison-lune" },
  ];
  const split = splitOrder(items, { "maison-lune": 0.1 });
  const by = Object.fromEntries(split.map((s) => [s.seller, s]));
  assert.deepEqual([by.dolgers.grossCents, by.dolgers.commissionCents, by.dolgers.netCents], [29_800, 0, 29_800]);
  assert.equal(by["atelier-rose"].grossCents, 35_997);
  assert.equal(by["atelier-rose"].commissionCents, Math.round(35_997 * COMMISSION_RATE)); // 4320
  assert.equal(by["atelier-rose"].netCents, 35_997 - 4_320);
  assert.equal(by["maison-lune"].commissionCents, 100); // 10% of 1001 = 100.1
  // Bad stored rates are clamped rather than paying out more than was charged.
  assert.equal(splitOrder([items[1]], { "atelier-rose": 5 })[0].netCents, 0);
  assert.equal(splitOrder([items[1]], { "atelier-rose": -1 })[0].commissionCents, 0);

  const sos = buildSellerOrders({ items, uid: "u1", address }, "ord1", {}, 5);
  assert.deepEqual(sos.map((s) => [s.id, s.payout]), [
    ["ord1_dolgers", "none"],
    ["ord1_atelier-rose", "held"],
    ["ord1_maison-lune", "held"],
  ]);
});

test("transfer reversal is proportional and capped", () => {
  const so = { grossCents: 10_000, netCents: 8_800 };
  assert.equal(reversalCents(so, 2_500), 2_200);
  assert.equal(reversalCents(so, 10_000), 8_800);
  assert.equal(reversalCents(so, 50_000), 8_800); // can't exceed gross share
  assert.equal(reversalCents(so, 10_000, 8_000), 800); // only what's left
  assert.equal(reversalCents(so, 0), 0);
});

// --- returns -----------------------------------------------------------------------------------

const so: SellerOrder = {
  orderId: "o1", seller: "atelier-rose", uid: "u1", address,
  items: [{ productId: "p1", variantId: "v1", title: "Thing", variantName: "Std", price: 49.5, qty: 2, seller: "atelier-rose" }],
  grossCents: 9_900, commissionCents: 1_188, netCents: 8_712, status: "shipped", shippedAt: 1_000 * DAY, payout: "transferred", createdAt: 999 * DAY,
};

test("return requests: item, quantity, reason and window are enforced", () => {
  const ok = { productId: "p1", variantId: "v1", qty: 1, reason: "Damaged or defective", details: "" };
  const opts = { now: 1_010 * DAY, returnDays: 30, alreadyReturned: 0 };
  assert.equal(validateReturn(ok, so, opts).amountCents, 4_950);
  assert.throws(() => validateReturn({ ...ok, productId: "nope" }, so, opts), MarketplaceError);
  assert.throws(() => validateReturn({ ...ok, qty: 3 }, so, opts), /at most 2/);
  assert.throws(() => validateReturn(ok, so, { ...opts, alreadyReturned: 2 }), /already has a return/);
  assert.throws(() => validateReturn({ ...ok, reason: "meh" }, so, opts), /reason/);
  // Window = shippedAt + returnDays + 7 transit days.
  assert.equal(returnDeadline(so, 30), (1_000 + 37) * DAY);
  assert.throws(() => validateReturn(ok, so, { ...opts, now: 1_038 * DAY }), /closed/);
  assert.equal(returnDeadline({ ...so, status: "canceled" }, 30), null);
});

test("return workflow transitions", () => {
  assert.equal(nextReturnStatus("requested", "seller", "approve"), "approved");
  assert.equal(nextReturnStatus("requested", "seller", "reject"), "rejected");
  assert.throws(() => nextReturnStatus("approved", "seller", "reject"), /Can't/);
  assert.throws(() => nextReturnStatus("requested", "seller", "refund"), /Can't/); // not a seller action
  assert.equal(nextReturnStatus("rejected", "customer", "escalate"), "escalated");
  // A customer can escalate an unanswered request only after the seller's response window.
  assert.throws(() => nextReturnStatus("requested", "customer", "escalate", { createdAt: 0, now: 2 * DAY }), /3 days/);
  assert.equal(nextReturnStatus("requested", "customer", "escalate", { createdAt: 0, now: 3 * DAY }), "escalated");
  assert.equal(nextReturnStatus("escalated", "admin", "refund"), "resolved_refund");
  assert.throws(() => nextReturnStatus("resolved_refund", "admin", "deny"), /Can't/);
});

// --- applications and listings -----------------------------------------------------------------

test("seller application validation", () => {
  const good = {
    businessName: "Acme Boutique", legalName: "Acme Boutique LLC", businessType: "llc", country: "us", website: "https://acme.example",
    phone: "+1 555 010 2000", categories: ["dresses", "not-a-category"], description: "We sell independent label dresses and knitwear.",
  };
  const cats = categories.map((c) => c.slug);
  const out = validateApplication(good, cats);
  assert.equal(out.country, "US");
  assert.deepEqual(out.categories, ["dresses"]);
  assert.throws(() => validateApplication({ ...good, businessType: "trust" }, cats), /business type/);
  assert.throws(() => validateApplication({ ...good, website: "javascript:alert(1)" }, cats), /Website/);
  assert.throws(() => validateApplication({ ...good, categories: [] }, cats), /category/);
  assert.throws(() => validateApplication({ ...good, description: "short" }, cats), /more/);
});

test("listing validation: prices, options, category tree", () => {
  const ctx = { categories, brandSlugs: ["aurelia"] };
  const good = {
    title: "Aurelia Linen Wrap Dress with Belt", description: "A breathable linen wrap dress with a removable fabric belt.",
    category: "dresses", subcategory: "casual-dresses", brand: "aurelia", fit: "Petite", specs: ["Fabric: 100% linen", ""],
    variants: [{ name: "Black", price: 89.999 }, { name: "Cream", price: 149, compareAtPrice: 179 }], stock: 12,
  };
  const l = validateListing(good, ctx);
  assert.equal(l.variants[0].price, 90);
  assert.equal(l.variants[0].id, "black");
  assert.deepEqual(l.specs, ["Fabric: 100% linen"]);
  assert.throws(() => validateListing({ ...good, subcategory: "jeans" }, ctx), /subcategory/);
  assert.throws(() => validateListing({ ...good, brand: "acme" }, ctx), /brand/);
  assert.throws(() => validateListing({ ...good, variants: [{ name: "A", price: 0 }] }, ctx), /between/);
  assert.throws(() => validateListing({ ...good, variants: [{ name: "A", price: 50, compareAtPrice: 40 }] }, ctx), /higher/);
  assert.throws(() => validateListing({ ...good, variants: [{ name: "A", price: 5 }, { name: "a", price: 6 }] }, ctx), /share/);
  assert.throws(() => validateListing({ ...good, stock: 1.5 }, ctx), /Stock/);

  const existing = l.variants;
  const upd = validateListingUpdate({ variants: [{ id: "cream", name: "Cream", price: 139 }, { id: "black", name: "Renamed", price: 80, compareAtPrice: 90 }], stock: 3 }, existing);
  assert.deepEqual(upd.variants, [
    { id: "black", name: "Black", price: 80, compareAtPrice: 90 },
    { id: "cream", name: "Cream", price: 139 },
  ]);
  assert.equal(upd.listingStatus, "active");
  assert.throws(() => validateListingUpdate({ variants: [{ id: "black", name: "x", price: 80 }], stock: 3 }, existing), /added or removed/);
});

test("tracking validation", () => {
  assert.deepEqual(validateTracking({ carrier: "UPS", trackingNumber: " 1Z 999 AA1 0123456784 " }), { carrier: "UPS", trackingNumber: "1Z999AA10123456784" });
  assert.throws(() => validateTracking({ carrier: "Pigeon", trackingNumber: "123456" }), /carrier/);
  assert.throws(() => validateTracking({ carrier: "UPS", trackingNumber: "<script>" }), /tracking/);
});

// --- storefront helpers ------------------------------------------------------------------------

test("collection filters", () => {
  const ids = (f: Record<string, string>) => filterProducts(catalog, filters(f)).map((p) => p.id);
  const all = ids({});
  assert.equal(all.length, catalog.length);
  assert.ok(ids({ fit: "Petite" }).length > 0);
  assert.ok(ids({ fit: "Petite" }).every((id) => byId.get(id)!.fit === "Petite"));
  assert.ok(ids({ fit: "Petite,Plus" }).length > ids({ fit: "Petite" }).length);
  assert.deepEqual(ids({ fit: "bogus" }), all); // unknown values are ignored, not "match nothing"
  assert.ok(ids({ seller: "dolgers" }).every((id) => !byId.get(id)!.seller));
  assert.ok(ids({ seller: "marketplace" }).every((id) => !!byId.get(id)!.seller));
  assert.equal(ids({ seller: "dolgers" }).length + ids({ seller: "marketplace" }).length, all.length);
  assert.ok(ids({ seller: "willow-and-thread" }).includes("willow-cashmere-blend-crewneck"));
  // Price range matches if any option is in range (trench: $168 stone, $172 black).
  assert.ok(ids({ min: "170", max: "175" }).includes("maison-double-breasted-trench"));
  assert.ok(!ids({ max: "100" }).includes("maison-double-breasted-trench"));
  assert.deepEqual(ids({ min: "-5" }), all);
  const stockless: Product[] = catalog.map((p, i) => (i === 0 ? { ...p, stock: 0 } : p));
  assert.equal(filterProducts(stockless, filters({ stock: "in" })).length, catalog.length - 1);
  assert.ok(ids({ clearance: "1" }).length > 0);
  assert.ok(ids({ clearance: "1" }).every((id) => byId.get(id)!.tags.includes("clearance")));
  assert.deepEqual(ids({ sub: "robes" }), ["willow-waffle-knit-robe"]);
});

test("delivery window: same-day cutoff, weekends and handling days", () => {
  // Mon 2026-09-28 10:00 in Chicago (15:00 UTC) → dispatch Mon → 2–4 business days.
  let w = deliveryWindow(0, new Date("2026-09-28T15:00:00Z"));
  assert.equal(shortDate(w.from), "Wed, Sep 30");
  assert.equal(shortDate(w.to), "Fri, Oct 2");
  // After 2pm → dispatch Tue.
  w = deliveryWindow(0, new Date("2026-09-28T20:00:00Z"));
  assert.equal(shortDate(w.from), "Thu, Oct 1");
  // Friday afternoon with 2 handling days → dispatch Mon + 2 = Wed → from Fri.
  w = deliveryWindow(2, new Date("2026-10-02T21:00:00Z"));
  assert.equal(shortDate(w.from), "Fri, Oct 9");
  // Saturday → dispatch Monday.
  w = deliveryWindow(0, new Date("2026-10-03T15:00:00Z"));
  assert.equal(shortDate(w.from), "Wed, Oct 7");
  // Late Sunday UTC is still Sunday afternoon in Chicago.
  w = deliveryWindow(0, new Date("2026-10-05T03:00:00Z"));
  assert.equal(shortDate(w.from), "Wed, Oct 7");
});

test("financing, specs, bought-together, compare, policies", () => {
  assert.equal(monthlyPaymentCents(19_899), null);
  assert.equal(monthlyPaymentCents(49_900), 4_159); // 415.83 rounded up
  const coat = byId.get("maison-double-breasted-trench")!;
  const rows = fullSpecs(coat, { brand: "Maison Lune", seller: "Maison Lune" });
  assert.ok(rows.some((r) => r.label === "Fit" && r.value === "Regular sizing"));
  assert.ok(rows.some((r) => r.label === "Colours" && r.value === "Stone · Black"));
  const wrap = fullSpecs(byId.get("aurelia-floral-wrap-midi-dress")!, {});
  assert.ok(wrap.some((r) => r.label === "Neckline" && r.value === "V-neck wrap with adjustable waist tie"));
  // Without a spec table, "Label: value" highlights become rows.
  const tee = fullSpecs(byId.get("sorella-ribbed-cotton-tee-3pack")!, {});
  assert.ok(tee.some((r) => r.label === "Fabric" && r.value === "95% cotton, 5% elastane"));

  const fbt = boughtTogether(coat, catalog);
  // The listing's own pick comes first, then the best-rated piece from another category tops up to two.
  assert.equal(fbt.length, 2);
  assert.equal(fbt[0].id, "marlowe-silk-feel-button-blouse");
  assert.ok(fbt[1].category !== "outerwear");
  // Fallback picks the best-rated pieces from other categories, never the product itself.
  const fb = boughtTogether(byId.get("nomi-wide-leg-denim")!, catalog);
  assert.equal(fb.length, 2);
  assert.ok(fb.every((p) => p.category !== "bottoms" && p.id !== "nomi-wide-leg-denim"));
  const cmp = compareSet(byId.get("nomi-high-waist-straight-jeans")!, catalog);
  assert.equal(cmp[0].subcategory, "jeans");
  assert.ok(cmp.every((p) => p.category === "bottoms" && p.id !== "nomi-high-waist-straight-jeans"));

  const atelier = sellers.find((s) => s.slug === "atelier-rose")!;
  assert.match(policyLines(atelier).returns, /handled by Atelier Rose/);
  assert.match(policyLines(sellers[0]).returns, /handled by Dolgers\.$/);
});

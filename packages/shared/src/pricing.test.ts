import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocate } from './money.ts';
import { priceCart, vendorSettlement } from './pricing.ts';
import type { Product, PromoCode } from './types.ts';

const base: Omit<Product, 'id' | 'slug' | 'vendorId' | 'vendorSlug' | 'vendorName' | 'title' | 'variants'> = {
  department: 'men', categoryId: 'c', categoryPath: ['men'], description: '', composition: '', care: '', fitNote: '',
  sizeSystem: 'alpha', colour: { name: 'Black', hex: '#000' }, images: [], related: [], status: 'live', reviewNote: '',
  featured: false, publishedAt: 0, createdAt: 0, updatedAt: 0, priceMin: 0, priceMax: 0,
};

const products = new Map<string, Product>([
  ['p1', { ...base, id: 'p1', slug: 'coat', vendorId: 'v1', vendorSlug: 'v1', vendorName: 'Nordhavn', title: 'Coat',
    variants: [{ sku: 'p1-m', size: 'M', price: 42000, compareAtPrice: null }] }],
  ['p2', { ...base, id: 'p2', slug: 'knit', vendorId: 'v2', vendorSlug: 'v2', vendorName: 'Ashby', title: 'Knit',
    variants: [{ sku: 'p2-m', size: 'M', price: 14500, compareAtPrice: null }] }],
  ['p3', { ...base, id: 'p3', slug: 'gone', vendorId: 'v2', vendorSlug: 'v2', vendorName: 'Ashby', title: 'Gone', status: 'archived',
    variants: [{ sku: 'p3-m', size: 'M', price: 100, compareAtPrice: null }] }],
]);
const stock = new Map([['p1-m', 5], ['p2-m', 1], ['p3-m', 9]]);

test('prices from the catalog, merges duplicate SKUs and flags stock problems', () => {
  const r = priceCart({
    lines: [{ sku: 'p1-m', quantity: 1 }, { sku: 'p1-m', quantity: 1 }, { sku: 'p2-m', quantity: 2 }, { sku: 'p3-m', quantity: 1 }, { sku: 'nope', quantity: 1 }],
    products, stock, delivery: 'standard', promo: null, now: 0,
  });
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].quantity, 2);
  assert.equal(r.totals.subtotal, 84000);
  assert.deepEqual(r.problems.map((p) => [p.sku, p.problem]), [['p2-m', 'insufficient_stock'], ['p3-m', 'unavailable'], ['nope', 'unavailable']]);
});

test('express delivery and percent promo, discount shared across vendors to the cent', () => {
  const promo: PromoCode = { code: 'TEN', type: 'percent', value: 10, minSubtotal: 0, active: true, startsAt: null, endsAt: null, maxRedemptions: null, redemptions: 0, createdAt: 0 };
  const r = priceCart({
    lines: [{ sku: 'p1-m', quantity: 1 }, { sku: 'p2-m', quantity: 1 }],
    products, stock, delivery: 'express', promo, promoCodeInput: 'ten', now: 0,
  });
  assert.equal(r.totals.subtotal, 56500);
  assert.equal(r.totals.discount, 5650);
  assert.equal(r.totals.shipping, 2500);
  assert.equal(r.totals.total, 56500 - 5650 + 2500);
  assert.equal(r.vendors.reduce((s, v) => s + v.discountShare, 0), 5650);
  assert.equal(r.promo?.applied, true);
});

test('rejects expired or under-minimum promo codes', () => {
  const promo: PromoCode = { code: 'BIG', type: 'fixed', value: 5000, minSubtotal: 100000, active: true, startsAt: null, endsAt: null, maxRedemptions: null, redemptions: 0, createdAt: 0 };
  const r = priceCart({ lines: [{ sku: 'p1-m', quantity: 1 }], products, stock, delivery: 'standard', promo, promoCodeInput: 'BIG', now: 0 });
  assert.equal(r.totals.discount, 0);
  assert.equal(r.promo?.applied, false);
});

test('allocate always sums to the total', () => {
  for (const [total, weights] of [[100, [1, 1, 1]], [7, [3, 3, 1]], [0, [5]], [5650, [42000, 14500]]] as [number, number[]][]) {
    assert.equal(allocate(total, weights).reduce((a, b) => a + b, 0), total);
  }
});

test('vendor settlement takes commission after discount', () => {
  assert.deepEqual(vendorSettlement(42000, 4200, 1500), { commission: 5670, vendorNet: 32130 });
});

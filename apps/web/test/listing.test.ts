import { describe, expect, it } from 'vitest';
import { type Evidence, type ListingDraft, type ListingInput, validateListing } from '../src/core/listing/listing.ts';
import type { ProductSnapshot } from '../src/core/types.ts';
import { DEFAULT_CONFIG } from '../src/core/vetting/config.ts';

const product = { title: 'x', attributes: {}, images: [], skus: [] } as unknown as ProductSnapshot;
const input = (o: Partial<ListingInput> = {}): ListingInput => ({
  product,
  skus: [{ skuId: 's1', props: { Size: 'L' }, shipsFrom: 'United States', priceCents: 1000, listPriceCents: null, stock: 5, image: null }],
  department: 'men',
  material: 'Polyester',
  sizeChart: null,
  listingFixes: [],
  delivery: null,
  reviewSummary: '',
  ...o,
});
const evidence: Evidence[] = [{ id: 'E1', fact: 'Material: Polyester', source: 'listing' }];
const draft = (o: Partial<ListingDraft> = {}): ListingDraft => ({
  title: "Men's Cargo Jogger Pants",
  handle: 'mens-cargo-jogger-pants',
  storeCategory: 'joggers',
  seo: { title: "Men's Cargo Jogger Pants", metaDescription: 'Relaxed joggers.', primaryKeyword: 'cargo joggers', secondaryKeywords: [] },
  bullets: ['Polyester'],
  description: ['Relaxed fit.'],
  faq: [],
  variants: [{ skuId: 's1', color: 'Black', size: 'L' }],
  imageAlts: [],
  claims: [{ text: 'Polyester', evidenceIds: ['E1'] }],
  ...o,
});
const check = (d: ListingDraft, i = input()) => validateListing(d, i, evidence, DEFAULT_CONFIG);

describe('validateListing', () => {
  it('passes a clean listing', () => {
    expect(check(draft())).toEqual([]);
  });

  it.each(['Made in USA', 'Made in the U.S.', 'made in US', 'USA-made', 'American made', 'Proudly manufactured in America'])(
    'catches US-manufacture claims: %s',
    (phrase) => {
      expect(check(draft({ bullets: ['Polyester', phrase] })).join()).toMatch(/US manufacture/);
    },
  );

  it('checks hidden fields too (handle, keywords, alt text, variant names)', () => {
    expect(check(draft({ handle: 'nike-cargo-pants' })).join()).toMatch(/protected name/);
    expect(check(draft({ seo: { ...draft().seo, secondaryKeywords: ['premium joggers'] } })).join()).toMatch(/Unsupported claim/);
    expect(check(draft({ imageAlts: [{ index: 0, alt: 'Cotton joggers' }] })).join()).toMatch(/Mentions cotton/);
  });

  it('only allows performance claims the evidence supports', () => {
    expect(check(draft({ bullets: ['Polyester', 'Breathable fabric'] })).join()).toMatch(/Performance claim "breathable"/);
    const ev: Evidence[] = [...evidence, { id: 'E2', fact: 'Feature: Breathable', source: 'listing' }];
    expect(validateListing(draft({ bullets: ['Polyester', 'Breathable fabric'] }), input(), ev, DEFAULT_CONFIG)).toEqual([]);
  });

  it('accepts a weave that matches the fibre and rejects a different fibre', () => {
    expect(check(draft({ bullets: ['Cotton denim'] }), input({ material: 'Cotton' }))).toEqual([]);
    expect(check(draft({ bullets: ['Soft modal blend'] })).join()).toMatch(/Mentions modal/);
  });

  it('requires each listing fix to actually appear on the page', () => {
    const i = input({ listingFixes: ['Disclose it plainly; remove the claim from the title', 'Promise the quoted delivery window, not a faster one'] });
    const missing = check(draft({ bullets: ['Polyester', 'Free shipping'] }), i).join();
    expect(missing).toMatch(/Listing fix not applied: Disclose/);
    expect(missing).toMatch(/Listing fix not applied: Promise/);
    expect(check(draft({ bullets: ['Polyester', 'Side zippers are decorative', 'Arrives in 6-10 days'] }), i)).toEqual([]);
  });

  it('flags supplier colour codes, missing variants and unknown material', () => {
    expect(check(draft({ variants: [{ skuId: 's1', color: 'LHT13-5P2', size: 'L' }] })).join()).toMatch(/supplier code/);
    expect(check(draft({ variants: [] })).join()).toMatch(/no US name/);
    expect(check(draft({ bullets: ['Relaxed'] }), input({ material: null })).join()).toMatch(/Material is not confirmed/);
  });
});

import { describe, expect, it } from 'vitest';
import type { ProductDoc, QualityEvent } from '../src/core/firestore/model.ts';
import { applyQualityEvent } from '../src/core/quality.ts';
import { DEFAULT_CONFIG } from '../src/core/vetting/config.ts';

const product = (o: Partial<ProductDoc> = {}): ProductDoc =>
  ({
    id: 'ae-1', status: 'live', holdReasons: [], flags: [],
    probation: { active: true, orders: 0, defects: 0, maxDefects: 2, windowOrders: 40 },
    ...o,
  }) as ProductDoc;
const ev = (o: Partial<QualityEvent>): QualityEvent => ({ at: 1, kind: 'orders', count: 1, category: null, bucket: null, note: '', by: 'me', ...o });
const apply = (p: ProductDoc, e: Partial<QualityEvent>) => {
  const { patch } = applyQualityEvent(p, ev(e), DEFAULT_CONFIG);
  return { ...p, ...patch } as ProductDoc;
};

describe('your own orders', () => {
  it('pauses after the first unfixable complaint from your customer', () => {
    const p = apply(product(), { kind: 'complaint', category: 'wash_durability', bucket: 'C', note: 'print peeled' });
    expect(p.status).toBe('paused');
    expect(p.holdReasons[0]).toMatch(/can't be fixed/);
  });

  it('pauses when refunds pass 10% once there are enough orders', () => {
    let p = apply(product({ probation: { active: false, orders: 0, defects: 0, maxDefects: 2, windowOrders: 40 } }), { kind: 'orders', count: 20 });
    p = apply(p, { kind: 'refund', count: 2 });
    expect(p.status).toBe('live'); // exactly 10%
    p = apply(p, { kind: 'refund', count: 1 });
    expect(p.status).toBe('paused');
    expect(p.holdReasons[0]).toMatch(/Refund rate is 15%/);
  });

  it('flags a payment dispute for review today without pausing', () => {
    const p = apply(product(), { kind: 'dispute', note: 'item not as described' });
    expect(p.status).toBe('live');
    expect(p.flags?.[0]).toMatchObject({ urgent: true });
    expect(p.flags?.[0]?.text).toMatch(/review this product today/);
  });

  it('ends probation after the window, and pauses on too many defects within it', () => {
    let p = apply(product(), { kind: 'orders', count: 10 });
    p = apply(p, { kind: 'complaint', category: 'stitching_defect', bucket: 'B' });
    expect(p.status).toBe('live');
    p = apply(p, { kind: 'complaint', category: 'hole_or_tear', bucket: 'B' });
    expect(p.status).toBe('paused');
    const q = apply(product(), { kind: 'orders', count: 40 });
    expect(q.probation.active).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fetchReviews, groupBuyers, isChinaLogistics, isPooled, parseReviewPage } from '../src/reviews/reviews.ts';

const raw = JSON.parse(readFileSync(new URL('./fixtures/reviews_pooled_acid_tee.json', import.meta.url), 'utf8'));

describe('parseReviewPage', () => {
  const page = parseReviewPage(raw);

  it('reads the pooled marker and the star counts', () => {
    expect(page.set.productType).toBe('HYPERCHAIN');
    expect(page.set.pooledNotice).toMatch(/various sellers/);
    expect(isPooled(page.set)).toBe(true);
    // 1,172 star ratings; only 322 have written reviews.
    expect(page.set.stats.total).toBe(1172);
    expect(page.set.stats.byStars[5]).toBe(1067);
    expect(page.totalPages).toBe(17);
  });

  it('normalizes each review', () => {
    const r = page.reviews[0]!;
    expect(r.stars).toBe(5);
    expect(r.date).toBe('2025-11-08');
    expect(r.country).toBe('US');
    expect(r.shipsFromUS).toBe(false);
    expect(isChinaLogistics(r.logistics)).toBe(true);
    const four = page.reviews.find((x) => x.buyer === 'C***r')!;
    expect(four.stars).toBe(4);
    expect(four.text).toMatch(/run small/);
  });

  it('groups one buyer’s multi-item order into one buyer', () => {
    expect(page.reviews).toHaveLength(20);
    // I***o, R***d, T***c and М***я each left two reviews for one order.
    expect(groupBuyers(page.reviews)).toHaveLength(16);
  });
});

describe('fetchReviews', () => {
  it('fetches every page and marks the set complete', async () => {
    const pages: number[] = [];
    const fetchImpl = (async (url: URL) => {
      const p = Number(new URL(url).searchParams.get('page'));
      pages.push(p);
      const body = structuredClone(raw);
      body.data.totalPage = 3;
      body.data.totalNum = 60;
      body.data.evaViewList = body.data.evaViewList.map((r: Record<string, unknown>) => ({
        ...r,
        evaluationIdStr: `${p}-${r.evaluationIdStr}`,
      }));
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const set = await fetchReviews('1005012172907050', { fetchImpl, sleep: async () => {} });
    expect(pages).toEqual([1, 2, 3]);
    expect(set.reviews).toHaveLength(60);
    expect(set.complete).toBe(true);
  });

  it('marks the set incomplete when a later page fails', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      if (n > 1) return new Response('blocked', { status: 403 });
      const body = structuredClone(raw);
      body.data.totalPage = 2;
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const set = await fetchReviews('1', { fetchImpl, sleep: async () => {} });
    expect(set.complete).toBe(false);
    expect(set.reviews).toHaveLength(20);
  });
});

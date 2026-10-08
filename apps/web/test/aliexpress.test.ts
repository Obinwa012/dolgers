import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AliExpressClient, MemoryTokenStore } from '../src/core/aliexpress/client.ts';
import { ProductUnavailableError, parseFeedPage, parseFreight, parseProduct } from '../src/core/aliexpress/parse.ts';
import { signMethod, signRest } from '../src/core/aliexpress/sign.ts';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('signing', () => {
  it('matches an independent HMAC-SHA256 implementation and skips empty params', () => {
    const p = {
      app_key: '12345',
      timestamp: '1700000000000',
      sign_method: 'sha256',
      method: 'aliexpress.ds.product.get',
      access_token: 'tok',
      product_id: '1005',
      empty: '',
    };
    expect(signMethod(p, 'secret')).toBe('17DF42CB93CF5D6BF14FC1F8A8DD01280A5A927EE61F6B22DDC2D609911E1B9D');
  });
  it('prefixes the API path for REST token calls', () => {
    const q = { app_key: '12345', timestamp: '1700000000000', sign_method: 'sha256', refresh_token: 'r1' };
    expect(signRest('/auth/token/refresh', q, 'secret')).toBe(
      'ADA2D254926EDF256052ED3277422E1E4C8873F698FCAFD9B8CF6BD4BC4F657C',
    );
  });
});

describe('parseProduct', () => {
  it('parses the cargo pants listing', () => {
    const p = parseProduct(fx('product_cargo.json'), '3256811859422872');
    expect(p.mainId).toBe('1005012045737624');
    expect(p.subId).toBe('3256811859422872');
    expect(p.reviewCount).toBe(34);
    expect(p.pooledListing).toBe(false);
    expect(p.store.ratings).toEqual({ asDescribed: 4.7, communication: 4.8, shipping: 4.8 });
    expect(p.skus).toHaveLength(5);
    expect(p.skus.every((s) => s.shipsFrom === 'United States')).toBe(true);
    const l = p.skus.find((s) => s.props.Size === 'L')!;
    expect(l.priceCents).toBe(2293);
    expect(l.props.Color).toBe('3PCS');
    expect(p.descriptionImages.length).toBeGreaterThan(0);
  });

  it('keeps attributes such as material and the seller size_info', () => {
    const p = parseProduct(fx('product_polo.json'), '3256809017242003');
    expect(p.attributes.Material).toBe('POLYESTER');
    expect(p.attributes.size_info).toContain('sizeInfoList');
    expect(p.skus).toHaveLength(24);
  });

  it('flags a dead listing', () => {
    expect(() => parseProduct(fx('product_unavailable.json'), 'x')).toThrow(ProductUnavailableError);
  });
});

describe('parseFreight', () => {
  it('reads free US shipping', () => {
    const q = parseFreight(fx('freight_ok.json'), 'sku', 1);
    expect(q.options[0]).toMatchObject({ carrier: 'USPS', shipFrom: 'US', feeCents: 0, free: true, minDays: 10, maxDays: 15 });
  });
  it('reads paid shipping in dollars despite the "cent" field name', () => {
    const q = parseFreight(fx('freight_paid.json'), 'sku', 1);
    expect(q.options[0]!.feeCents).toBe(299);
  });
  it('reports the error when no option comes back', () => {
    const q = parseFreight(fx('freight_error.json'), 'sku', 1);
    expect(q.options).toHaveLength(0);
    expect(q.error).toBe('DELIVERY_SERVICE_EXCEPTION');
  });
});

describe('parseFeedPage', () => {
  it('normalizes feed items', () => {
    const page = parseFeedPage(fx('feed_page.json'), 'AEB_US Local Items');
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(2007);
    expect(page.items[0]!.subId).toMatch(/^3256/);
    expect(page.items[0]!.feedName).toBe('AEB_US Local Items');
  });
});

describe('AliExpressClient', () => {
  const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('waits out the rate limit and retries', async () => {
    const calls: string[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      calls.push('call');
      if (n === 1) {
        return jsonResponse({ error_response: { code: 'ApiCallLimit', msg: 'this ban will last 3 seconds' } });
      }
      return jsonResponse(fx('product_cargo.json'));
    }) as typeof fetch;
    const slept: number[] = [];
    const c = new AliExpressClient({
      appKey: 'k',
      appSecret: 's',
      tokens: new MemoryTokenStore({ accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600e3, refreshExpiresAt: null }),
      fetchImpl,
      sleep: async (ms) => void slept.push(ms),
    });
    const p = await c.product('3256811859422872');
    expect(p.mainId).toBe('1005012045737624');
    expect(calls).toHaveLength(2);
    expect(slept).toContain(5000);
  });

  it('refreshes an expiring token before calling', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string | URL) => {
      urls.push(String(url));
      if (String(url).includes('/auth/token/refresh')) {
        return jsonResponse({ access_token: 'new', refresh_token: 'r2', expires_in: 86400 });
      }
      return jsonResponse(fx('product_cargo.json'));
    }) as typeof fetch;
    const store = new MemoryTokenStore({ accessToken: 'old', refreshToken: 'r1', expiresAt: Date.now() + 60e3, refreshExpiresAt: null });
    const c = new AliExpressClient({ appKey: 'k', appSecret: 's', tokens: store, fetchImpl, sleep: async () => {} });
    await c.product('3256811859422872');
    expect(urls[0]).toContain('/auth/token/refresh');
    expect((await store.load())!.accessToken).toBe('new');
    expect((await store.load())!.refreshToken).toBe('r2');
  });
});

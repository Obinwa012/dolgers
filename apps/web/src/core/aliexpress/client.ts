import type { FreightQuote, ProductSnapshot } from '../types.ts';
import { obj, sleep as realSleep, str } from '../util.ts';
import { type FeedPage, parseFeedPage, parseFreight, parseProduct } from './parse.ts';
import { signMethod, signRest } from './sign.ts';

const GATEWAY = 'https://api-sg.aliexpress.com/sync';
const TOKEN_HOST = 'https://api-sg.aliexpress.com/rest';
const AUTHORIZE_URL = 'https://api-sg.aliexpress.com/oauth/authorize';

export interface AeTokens {
  accessToken: string;
  refreshToken: string | null;
  /** ms epoch */
  expiresAt: number;
  /** ms epoch; when the refresh token itself stops working. */
  refreshExpiresAt: number | null;
}

/** Where tokens live. The pipeline uses a Firestore-backed store; tests use memory. */
export interface TokenStore {
  load(): Promise<AeTokens | null>;
  save(tokens: AeTokens): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  constructor(private tokens: AeTokens | null = null) {}
  async load() {
    return this.tokens;
  }
  async save(t: AeTokens) {
    this.tokens = t;
  }
}

export class AeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly raw?: unknown,
  ) {
    super(`AliExpress ${code}: ${message}`);
  }
}

export interface ClientOptions {
  appKey: string;
  appSecret: string;
  tokens: TokenStore;
  /** Minimum gap between API calls. AliExpress bans an app for ~30s when it calls too fast. */
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (msg: string) => void;
}

type Params = Record<string, string | number | undefined | null>;

export class AliExpressClient {
  private lastCall = 0;
  private readonly minInterval: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly opts: ClientOptions) {
    this.minInterval = opts.minIntervalMs ?? 1100;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? realSleep;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
  }

  // ---------- auth ----------

  authorizeUrl(redirectUri: string, state: string): string {
    const u = new URL(AUTHORIZE_URL);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('force_auth', 'true');
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('client_id', this.opts.appKey);
    u.searchParams.set('state', state);
    return u.toString();
  }

  /** Exchange the one-time code from the authorize redirect for tokens, and store them. */
  async exchangeCode(code: string): Promise<AeTokens> {
    return this.tokenRequest('/auth/token/create', { code: code.trim() });
  }

  async refresh(refreshToken: string): Promise<AeTokens> {
    return this.tokenRequest('/auth/token/refresh', { refresh_token: refreshToken });
  }

  private async tokenRequest(apiPath: string, extra: Record<string, string>): Promise<AeTokens> {
    const params: Record<string, string> = {
      app_key: this.opts.appKey,
      timestamp: String(this.now()),
      sign_method: 'sha256',
      ...extra,
    };
    params.sign = signRest(apiPath, params, this.opts.appSecret);
    // A one-time authorization code must not be resent: a retry after the server used it fails confusingly.
    const json = await this.post(`${TOKEN_HOST}${apiPath}`, params, extra.code ? 1 : 3);
    const t = unwrapToken(json);
    if (!t.access_token) {
      throw new AeApiError(str(t.code) || 'TokenError', str(t.message || t.msg) || 'token request failed', json);
    }
    const now = this.now();
    const tokens: AeTokens = {
      accessToken: str(t.access_token),
      refreshToken: t.refresh_token ? str(t.refresh_token) : extra.refresh_token ?? null,
      expiresAt: expiry(t.expire_time, t.expires_in, now),
      refreshExpiresAt: t.refresh_token_valid_time
        ? Number(t.refresh_token_valid_time)
        : t.refresh_expires_in
          ? now + Number(t.refresh_expires_in) * 1000
          : null,
    };
    await this.opts.tokens.save(tokens);
    return tokens;
  }

  /** A live access token, refreshed automatically when it is within 10 minutes of expiry. */
  async accessToken(): Promise<string> {
    const t = await this.opts.tokens.load();
    if (!t) throw new AeApiError('NoToken', 'AliExpress is not connected. Open Settings and connect your AliExpress account.');
    if (t.expiresAt > this.now() + 10 * 60_000) return t.accessToken;
    if (!t.refreshToken) {
      throw new AeApiError('TokenExpired', 'AliExpress access token expired and no refresh token is stored. Reconnect AliExpress in Settings.');
    }
    this.log('Refreshing AliExpress access token');
    return (await this.refresh(t.refreshToken)).accessToken;
  }

  // ---------- transport ----------

  private async post(url: string, params: Record<string, string>, attempts = 5): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
          body: new URLSearchParams(params).toString(),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (attempt + 1 < attempts) await this.sleep(2000 * (attempt + 1));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /** Serialized, throttled, retried call to a /sync business method. */
  call(method: string, params: Params = {}): Promise<unknown> {
    const run = async () => {
      let refreshed = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const wait = this.lastCall + this.minInterval - this.now();
        if (wait > 0) await this.sleep(wait);
        this.lastCall = this.now();
        const token = await this.accessToken();
        const p: Record<string, string> = {
          app_key: this.opts.appKey,
          timestamp: String(this.now()),
          sign_method: 'sha256',
          method,
          access_token: token,
        };
        for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) p[k] = String(v);
        p.sign = signMethod(p, this.opts.appSecret);
        const json = await this.post(GATEWAY, p);
        const err = obj(obj(json).error_response);
        if (Object.keys(err).length) {
          const code = str(err.code);
          if (/Limit/i.test(code)) {
            const secs = Number(/(\d+)\s*second/i.exec(str(err.msg))?.[1] ?? 30);
            this.log(`Rate limited by AliExpress; waiting ${secs + 2}s`);
            await this.sleep((secs + 2) * 1000);
            continue;
          }
          if (code === 'IllegalAccessToken' && !refreshed) {
            // Token revoked or expired early: force one refresh, then retry.
            refreshed = true;
            const t = await this.opts.tokens.load();
            if (t?.refreshToken) {
              await this.refresh(t.refreshToken);
              continue;
            }
          }
          throw new AeApiError(code, str(err.sub_msg || err.msg), json);
        }
        return json;
      }
      throw new AeApiError('RetryExhausted', `${method} kept hitting the rate limit`);
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  // ---------- business methods ----------

  async feedPage(
    feedName: string,
    o: { categoryId?: string; page: number; pageSize?: number; sort?: string; country?: string },
  ): Promise<FeedPage> {
    const json = await this.call('aliexpress.ds.recommend.feed.get', {
      feed_name: feedName,
      category_id: o.categoryId,
      country: o.country ?? 'US',
      target_currency: 'USD',
      target_language: 'EN',
      page_size: o.pageSize ?? 50,
      page_no: o.page,
      sort: o.sort,
    });
    return parseFeedPage(json, feedName);
  }

  async product(productId: string): Promise<ProductSnapshot> {
    const json = await this.call('aliexpress.ds.product.get', {
      product_id: productId,
      ship_to_country: 'US',
      target_currency: 'USD',
      target_language: 'en',
    });
    return parseProduct(json, productId, this.now());
  }

  /** US shipping quote for one SKU. Retries the API's intermittent DELIVERY_SERVICE_EXCEPTION. */
  async freight(mainId: string, skuId: string, quantity = 1): Promise<FreightQuote> {
    let quote: FreightQuote | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const json = await this.call('aliexpress.ds.freight.query', {
        queryDeliveryReq: JSON.stringify({
          quantity,
          shipToCountry: 'US',
          productId: mainId,
          selectedSkuId: skuId,
          language: 'en_US',
          currency: 'USD',
          locale: 'en_US',
        }),
      });
      quote = parseFreight(json, skuId, quantity);
      if (quote.options.length || !/EXCEPTION|busy/i.test(quote.error ?? '')) return quote;
      await this.sleep(4000);
    }
    return quote!;
  }
}

function unwrapToken(json: unknown): Record<string, unknown> {
  const p = obj(json);
  for (const k of ['result', 'aliexpress_system_oauth_token_create_response', 'aliexpress_system_oauth_token_refresh_response']) {
    const node = obj(p[k]);
    if (node.access_token) return node;
  }
  return p;
}

function expiry(expireTime: unknown, expiresIn: unknown, now: number): number {
  const et = Number(expireTime);
  if (Number.isFinite(et) && et > now) return et;
  const ei = Number(expiresIn);
  if (Number.isFinite(ei) && ei > 0) return now + ei * 1000;
  return now + 24 * 3600 * 1000;
}

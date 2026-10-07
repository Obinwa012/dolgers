import 'server-only';
import { createHmac } from 'crypto';
import { serverDb } from './server/firebase-admin';

const GATEWAY = 'https://api-sg.aliexpress.com/sync';
const TOKEN_URL = 'https://api-sg.aliexpress.com/rest/auth/token/create';
const TOKEN_API_PATH = '/auth/token/create';
export const AE_OAUTH_AUTHORIZE = 'https://api-sg.aliexpress.com/oauth/authorize';

export interface AeCreds {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
  /** ms epoch */
  expiresAt?: number;
}

interface SecretsDoc {
  aeAppKey?: string;
  aeAppSecret?: string;
  aeAccessToken?: string;
  aeRefreshToken?: string;
  aeExpiresAt?: number;
  updatedAt?: number;
}

export async function getAeCreds(): Promise<AeCreds | null> {
  const db = serverDb();
  if (!db) return null;
  const snap = await db.collection('config').doc('secrets').get();
  const d = snap.data() as SecretsDoc | undefined;
  if (!d?.aeAppKey || !d?.aeAppSecret) return null;
  return {
    appKey: d.aeAppKey,
    appSecret: d.aeAppSecret,
    accessToken: d.aeAccessToken,
    refreshToken: d.aeRefreshToken,
    expiresAt: d.aeExpiresAt,
  };
}

export async function saveAeCreds(patch: Partial<SecretsDoc>): Promise<void> {
  const db = serverDb();
  if (!db) throw new Error('Database unavailable.');
  await db
    .collection('config')
    .doc('secrets')
    .set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

/** Method-style signing: sorted key+value concat, HMAC-SHA256, upper hex. */
function signMethod(params: Record<string, string>, appSecret: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort();
  const base = keys.map((k) => `${k}${params[k]}`).join('');
  return createHmac('sha256', appSecret).update(base, 'utf8').digest('hex').toUpperCase();
}

/** REST token-endpoint signing: API_PATH prefix + sorted key+value concat. */
function signRest(params: Record<string, string>, appSecret: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort();
  const base = TOKEN_API_PATH + keys.map((k) => `${k}${params[k]}`).join('');
  return createHmac('sha256', appSecret).update(base, 'utf8').digest('hex').toUpperCase();
}

async function postForm(url: string, params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  return res.json();
}

function unwrapToken(payload: unknown): { accessToken?: string; refreshToken?: string; expiresIn?: number; error?: string } {
  const p = payload as Record<string, unknown>;
  if (p && typeof p === 'object' && 'error_response' in p) {
    const e = (p.error_response as Record<string, unknown>) ?? {};
    return { error: String(e.sub_msg ?? e.msg ?? 'token request failed') };
  }
  const wrappers = ['result', 'aliexpress_system_oauth_token_create_response', 'aliexpress_system_common_response'];
  for (const w of wrappers) {
    const node = p?.[w] as Record<string, unknown> | undefined;
    if (node && typeof node === 'object' && node.access_token) {
      return {
        accessToken: String(node.access_token),
        refreshToken: node.refresh_token ? String(node.refresh_token) : undefined,
        expiresIn: node.expires_in ? Number(node.expires_in) : undefined,
      };
    }
  }
  if (p && typeof p === 'object' && (p as Record<string, unknown>).access_token) {
    const n = p as Record<string, unknown>;
    return {
      accessToken: String(n.access_token),
      refreshToken: n.refresh_token ? String(n.refresh_token) : undefined,
      expiresIn: n.expires_in ? Number(n.expires_in) : undefined,
    };
  }
  return { error: 'Unexpected token response (no access_token).' };
}

export async function exchangeCodeForTokens(creds: AeCreds, code: string): Promise<void> {
  const params: Record<string, string> = {
    app_key: creds.appKey,
    code: code.trim(),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
  };
  params.sign = signRest(params, creds.appSecret);
  const t = unwrapToken(await postForm(TOKEN_URL, params));
  if (!t.accessToken) throw new Error(t.error ?? 'Code exchange failed.');
  await saveAeCreds({
    aeAccessToken: t.accessToken,
    aeRefreshToken: t.refreshToken,
    aeExpiresAt: Date.now() + (t.expiresIn ? t.expiresIn * 1000 : 24 * 3600 * 1000),
  });
}

/** Returns a live access token, refreshing with the stored refresh token when needed. */
export async function ensureAccessToken(creds: AeCreds): Promise<string> {
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > Date.now() + 60_000) {
    return creds.accessToken;
  }
  if (!creds.refreshToken) {
    throw new Error('No AliExpress token on file — connect via Settings first.');
  }
  const params: Record<string, string> = {
    app_key: creds.appKey,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
    timestamp: String(Date.now()),
    sign_method: 'sha256',
  };
  params.sign = signRest(params, creds.appSecret);
  const t = unwrapToken(await postForm(TOKEN_URL, params));
  if (!t.accessToken) throw new Error(t.error ?? 'Token refresh failed — reconnect via Settings.');
  await saveAeCreds({
    aeAccessToken: t.accessToken,
    aeRefreshToken: t.refreshToken ?? creds.refreshToken,
    aeExpiresAt: Date.now() + (t.expiresIn ? t.expiresIn * 1000 : 24 * 3600 * 1000),
  });
  return t.accessToken;
}

interface MethodParams {
  [k: string]: string;
}

async function methodCall(creds: AeCreds, method: string, biz: MethodParams): Promise<unknown> {
  const accessToken = await ensureAccessToken(creds);
  const params: Record<string, string> = {
    app_key: creds.appKey,
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    simplify: 'true',
    access_token: accessToken,
    session: accessToken,
    method,
    ...biz,
  };
  params.sign = signMethod(params, creds.appSecret);
  return postForm(GATEWAY, params);
}

export interface SearchProduct {
  productId: string;
  title: string;
  image: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  rating: number | null;
  orders: number | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Normalize a rating to the 5-star scale. evaluateRate comes back as a
 *  percentage (e.g. "100.0"); score is already 0-5. */
function normRating(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  if (n > 5.5) return Math.round((n / 20) * 10) / 10;
  return n;
}

const PRODUCT_ID_KEYS = ['product_id', 'productId', 'itemId', 'item_id', 'productID', 'id'];
const PRODUCT_TITLE_KEYS = ['product_title', 'productTitle', 'title'];

/** Heuristic: is this object one search-result product? */
function isProductLike(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const r = o as Record<string, unknown>;
  const hasId = PRODUCT_ID_KEYS.some((k) => typeof r[k] === 'string' || typeof r[k] === 'number');
  const hasTitle = PRODUCT_TITLE_KEYS.some((k) => typeof r[k] === 'string' && (r[k] as string).length > 0);
  return hasId && hasTitle;
}

/**
 * Find the products array anywhere under a response node, tolerant of shape
 * drift: AliExpress renames the wrapper key between queries/endpoints, so we
 * prefer the documented keys but fall back to scanning for the first array of
 * product-like objects (also handles JSON-string-encoded payloads).
 */
function findProductArray(node: unknown, depth = 0): { list: Record<string, unknown>[]; via: string } | null {
  if (depth > 6 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    if (node.length > 0 && isProductLike(node[0])) return { list: node, via: 'array-scan' };
    for (const el of node) {
      const found = findProductArray(el, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const r = node as Record<string, unknown>;
  for (const k of ['selection_search_product', 'product', 'products', 'item']) {
    const v = r[k];
    if (Array.isArray(v) && v.length > 0 && isProductLike(v[0])) {
      return { list: v as Record<string, unknown>[], via: `key:${k}` };
    }
  }
  // String-encoded JSON payloads (AliExpress does this on some endpoints).
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const found = findProductArray(JSON.parse(v) as unknown, depth + 1);
        if (found) return { list: found.list, via: `json-string:${k}→${found.via}` };
      } catch {
        /* not JSON */
      }
    }
  }
  for (const k of Object.keys(r)) {
    const found = findProductArray(r[k], depth + 1);
    if (found) return { list: found.list, via: `${k}→${found.via}` };
  }
  return null;
}

/** aliexpress.ds.text.search — categoryId + keyWord + ship_from=US filter. */
export async function aeTextSearch(
  creds: AeCreds,
  opts: { keyword: string; categoryId: string; pageIndex: number; pageSize: number },
): Promise<{ products: SearchProduct[]; totalCount: number | null; debug: { topKeys: string[]; dataKeys: string[]; firstProductKeys: string[]; parseVia: string; rawCount: number; parsedCount: number } }> {
  const searchExtend = JSON.stringify([{ min: '', max: '', searchKey: 'ship_from', searchValue: 'US' }]);
  const payload = (await methodCall(creds, 'aliexpress.ds.text.search', {
    keyWord: opts.keyword,
    categoryId: opts.categoryId,
    local: 'en_US',
    countryCode: 'US',
    currency: 'USD',
    pageIndex: String(opts.pageIndex),
    pageSize: String(opts.pageSize),
    sortBy: 'orders,desc',
    searchExtend,
  })) as Record<string, unknown>;

  if (payload && typeof payload === 'object' && 'error_response' in payload) {
    const e = (payload.error_response as Record<string, unknown>) ?? {};
    throw new Error(`Search failed: ${String(e.sub_msg ?? e.msg ?? 'unknown')}`);
  }
  const node = (payload?.['aliexpress_ds_text_search_response'] as Record<string, unknown>) ?? payload ?? {};
  const code = String(node.code ?? node.rsp_code ?? '');
  if (code && !['0', '00', '000', '200'].includes(code)) {
    throw new Error(`Search failed (code ${code}): ${String(node.message ?? node.rsp_msg ?? '')}`);
  }
  const data = (node.data as Record<string, unknown>) ?? node;
  const totalCount = num(data.totalCount);
  // Prefer the products node, widen to all of data if the wrapper key drifted.
  const productsNode = (data.products as unknown) ?? data;
  const found = findProductArray(productsNode);
  const raw = found?.list ?? [];
  const parseVia = found?.via ?? '(none)';
  const products = (raw as Record<string, unknown>[]).map((r) => ({
    // simplify=true returns camelCase (itemId, targetSalePrice, evaluateRate,
    // itemMainPic); non-simplified responses use snake_case. Accept both.
    // score is the 5-star rating; evaluateRate is a satisfaction percentage.
    productId: str(r.product_id ?? r.productId ?? r.itemId ?? r.item_id ?? r.productID ?? r.id),
    title: str(r.product_title ?? r.productTitle ?? r.title),
    image: str(r.product_main_image_url ?? r.productMainImageUrl ?? r.itemMainPic ?? r.imageUrl ?? r.image),
    priceMin: num(r.target_sale_price ?? r.targetSalePrice ?? r.salePrice ?? r.sale_price),
    priceMax: num(r.target_sale_price_max ?? r.targetSalePriceMax ?? r.target_sale_price ?? r.targetSalePrice ?? r.salePrice ?? r.sale_price),
    currency: str(r.target_sale_price_currency ?? r.targetOriginalPriceCurrency ?? r.salePriceCurrency ?? r.currency ?? 'USD') || 'USD',
    rating: normRating(r.score ?? r.evaluate_rate ?? r.evaluateRate),
    orders: num(r.lastest_volume ?? r.orders),
  })).filter((p) => p.productId);
  return {
    products,
    totalCount,
    debug: { ...describeSearchPayload(payload), parseVia, rawCount: raw.length, parsedCount: products.length },
  };
}

/** Minimal shape info for diagnosing parse issues (admin eyes only). */
export function describeSearchPayload(payload: unknown): { topKeys: string[]; dataKeys: string[]; firstProductKeys: string[] } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const node = (p['aliexpress_ds_text_search_response'] as Record<string, unknown>) ?? p;
  const data = (node?.data as Record<string, unknown>) ?? {};
  const products = (data as Record<string, unknown>).products as unknown;
  let first: Record<string, unknown> = {};
  const arr = Array.isArray(products) ? products : [];
  if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
    first = arr[0] as Record<string, unknown>;
  } else if (products && typeof products === 'object') {
    const po = products as Record<string, unknown>;
    for (const k of ['selection_search_product', 'product', 'products', 'item']) {
      const inner = po[k];
      if (Array.isArray(inner) && inner.length > 0 && typeof inner[0] === 'object') {
        first = inner[0] as Record<string, unknown>;
        break;
      }
    }
  }
  return {
    topKeys: Object.keys(p).slice(0, 12),
    dataKeys: Object.keys(data).slice(0, 12),
    firstProductKeys: Object.keys(first).slice(0, 20),
  };
}

export interface FreightOption {
  carrier: string;
  eta: string;
  cost: number | null;
  currency: string;
  tracking: boolean;
  raw: string;
}

/**
 * Normalize the many shapes freight.calculate can return into a flat option list.
 * Real shape (verified live 2026-10-06):
 *   result.aeop_freight_calculate_result_for_buyer_d_t_o_list
 *     .aeop_freight_calculate_result_for_buyer_dto[] = {
 *       service_name, estimated_delivery_time,
 *       freight: { amount, cent, currency_code },
 *       error_code, tracking_available }
 */
const FREIGHT_LIST_KEYS = [
  'freight',
  'options',
  'shippingOptions',
  'list',
  'data',
  'result',
  'aeop_freight_calculate_result_for_buyer_d_t_o_list',
  'aeop_freight_calculate_result_for_buyer_dto',
];

function normalizeFreight(result: unknown): FreightOption[] {
  const out: FreightOption[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const r = node as Record<string, unknown>;
    if (typeof r.error_code === 'number' && r.error_code !== 0) return; // unreachable option
    const carrier = r.service_name ?? r.logisticsCompany ?? r.logistics_company ?? r.carrier ?? r.company;
    const eta = r.estimated_delivery_time ?? r.deliveryTime ?? r.delivery_time ?? r.eta ?? r.time;
    const freightObj = (r.freight && typeof r.freight === 'object' ? r.freight : {}) as Record<string, unknown>;
    const amount = r.freightAmount ?? r.freight_amount ?? r.price ?? r.amount ?? r.cost ?? freightObj.amount ?? freightObj.value;
    if (carrier !== undefined || eta !== undefined || amount !== undefined) {
      let cost: number | null = null;
      let currency = 'USD';
      if (amount && typeof amount === 'object') {
        const a = amount as Record<string, unknown>;
        cost = num(a.amount ?? a.value);
        if (a.currency) currency = String(a.currency);
      } else {
        cost = num(amount);
      }
      const cur = freightObj.currency_code ?? r.currencyCode ?? r.currency;
      if (cur) currency = String(cur);
      const tr = r.trackingAvailable ?? r.tracking_available ?? r.tracking;
      out.push({
        carrier: str(carrier) || 'Unknown',
        eta: str(eta),
        cost,
        currency,
        tracking: tr === true || String(tr).toLowerCase() === 'true',
        raw: JSON.stringify(r).slice(0, 500),
      });
      return;
    }
    // Recurse into likely containers, but avoid runaway on huge payloads.
    for (const k of FREIGHT_LIST_KEYS) {
      if (k in r) visit(r[k]);
    }
  };
  visit(result);
  return out;
}

/**
 * aliexpress.logistics.buyer.freight.calculate with send_goods_country_code=US.
 * Per the vetting rule this is the source of truth: options returned => the
 * product truly ships from the US; none/error => no US stock.
 * Returns the raw result's top-level keys too, so parse misses are diagnosable.
 */
export async function aeFreightUS(
  creds: AeCreds,
  productId: string,
): Promise<{ options: FreightOption[]; rawKeys: string[]; rawSample: string }> {
  const dto = JSON.stringify({
    product_id: String(productId),
    product_num: 1,
    country_code: 'US',
    send_goods_country_code: 'US',
  });
  const payload = (await methodCall(creds, 'aliexpress.logistics.buyer.freight.calculate', {
    param_aeop_freight_calculate_for_buyer_d_t_o: dto,
  })) as Record<string, unknown>;

  if (payload && typeof payload === 'object' && 'error_response' in payload) {
    const e = (payload.error_response as Record<string, unknown>) ?? {};
    throw new Error(`Freight failed: ${String(e.sub_msg ?? e.msg ?? 'unknown')}`);
  }
  const node = (payload?.['aliexpress_logistics_buyer_freight_calculate_response'] as Record<string, unknown>) ?? payload ?? {};
  const result = (node.result as unknown) ?? node;
  const rawKeys =
    result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result).slice(0, 15) : [];
  const rawSample =
    result && typeof result === 'object' ? JSON.stringify(result).slice(0, 600) : '';
  if (result && typeof result === 'object' && (result as Record<string, unknown>).success === false) {
    return { options: [], rawKeys, rawSample }; // "not reachable" => no US stock
  }
  return { options: normalizeFreight(result), rawKeys, rawSample };
}

export function buildAuthorizeUrl(appKey: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    response_type: 'code',
    force_auth: 'true',
    client_id: appKey,
    redirect_uri: redirectUri,
    state,
  });
  return `${AE_OAUTH_AUTHORIZE}?${q.toString()}`;
}

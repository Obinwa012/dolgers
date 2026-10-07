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

/** aliexpress.ds.text.search — categoryId + keyWord + ship_from=US filter. */
export async function aeTextSearch(
  creds: AeCreds,
  opts: { keyword: string; categoryId: string; pageIndex: number; pageSize: number },
): Promise<{ products: SearchProduct[]; totalCount: number | null }> {
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
  let raw: unknown[] = [];
  const products = data.products as unknown;
  if (Array.isArray(products)) raw = products;
  else if (products && typeof products === 'object') {
    const p = products as Record<string, unknown>;
    for (const k of ['selection_search_product', 'product', 'products', 'item']) {
      const inner = p[k];
      if (Array.isArray(inner)) { raw = inner; break; }
      if (inner && typeof inner === 'object') { raw = [inner]; break; }
    }
  }
  return {
    products: (raw as Record<string, unknown>[]).map((r) => ({
      productId: str(r.product_id ?? r.productId),
      title: str(r.product_title ?? r.productTitle),
      image: str(r.product_main_image_url ?? r.product_main_image ?? r.productMainImageUrl),
      priceMin: num(r.target_sale_price ?? r.sale_price ?? r.target_sale_price_min),
      priceMax: num(r.target_sale_price_max ?? r.target_sale_price ?? r.sale_price),
      currency: str(r.target_sale_price_currency ?? r.currency ?? 'USD') || 'USD',
      rating: num(r.evaluate_rate),
      orders: num(r.lastest_volume ?? r.orders),
    })).filter((p) => p.productId),
    totalCount,
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

/** Normalize the many shapes freight.calculate can return into a flat option list. */
function normalizeFreight(result: unknown): FreightOption[] {
  const out: FreightOption[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const r = node as Record<string, unknown>;
    const carrier = r.logisticsCompany ?? r.logistics_company ?? r.carrier ?? r.company;
    const eta = r.deliveryTime ?? r.delivery_time ?? r.eta ?? r.time;
    const amount = r.freightAmount ?? r.freight_amount ?? r.price ?? r.amount ?? r.cost;
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
      if (r.currency) currency = String(r.currency);
      out.push({
        carrier: str(carrier) || 'Unknown',
        eta: str(eta),
        cost,
        currency,
        tracking: r.tracking === true || String(r.tracking).toLowerCase() === 'true',
        raw: JSON.stringify(r).slice(0, 500),
      });
      return;
    }
    // Recurse into likely containers, but avoid runaway on huge payloads.
    for (const k of ['freight', 'options', 'shippingOptions', 'list', 'data', 'result']) {
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
 */
export async function aeFreightUS(creds: AeCreds, productId: string): Promise<FreightOption[]> {
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
  if (result && typeof result === 'object' && (result as Record<string, unknown>).success === false) {
    return []; // "not reachable" => no US stock
  }
  return normalizeFreight(result);
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

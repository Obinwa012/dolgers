import type { FeedItem, FreightQuote, ProductSnapshot, ShippingOption, Sku } from '../types.ts';
import { asArray, dollarsToCents, num, obj, str } from '../util.ts';

export function parseFeedItem(raw: unknown, feedName: string): FeedItem {
  const p = obj(raw);
  return {
    subId: str(p.product_id),
    feedName,
    title: str(p.product_title),
    categoryId: p.first_level_category_id != null ? str(p.first_level_category_id) : null,
    subcategoryId: p.second_level_category_id != null ? str(p.second_level_category_id) : null,
    subcategoryName: p.second_level_category_name != null ? str(p.second_level_category_name) : null,
    feedPriceCents: dollarsToCents(p.target_sale_price),
    recentSales: num(p.lastest_volume) ?? 0,
    shopId: p.shop_id != null ? str(p.shop_id) : null,
    sellerId: p.seller_id != null ? str(p.seller_id) : null,
    mainImage: p.product_main_image_url ? str(p.product_main_image_url) : null,
  };
}

export interface FeedPage {
  items: FeedItem[];
  total: number | null;
  finished: boolean;
}

export function parseFeedPage(json: unknown, feedName: string): FeedPage {
  const result = obj(obj(obj(json).aliexpress_ds_recommend_feed_get_response).result);
  const raw = asArray(obj(result.products).traffic_product_d_t_o as unknown[]);
  return {
    items: raw.map((r) => parseFeedItem(r, feedName)).filter((i) => i.subId),
    total: num(result.total_record_count),
    finished: result.is_finished === true || raw.length === 0,
  };
}

function imagesFromDetail(html: string, mobileDetail: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/src="([^"]+)"/g)) out.add(m[1]!);
  try {
    const mobile = obj(JSON.parse(mobileDetail));
    for (const mod of asArray(mobile.moduleList as unknown[])) {
      const m = obj(mod);
      if (m.type === 'image') {
        const url = str(obj(m.data).url);
        if (url) out.add(url);
      }
    }
  } catch {
    /* mobile_detail is optional and sometimes not JSON */
  }
  return [...out].filter((u) => /^https?:\/\//.test(u));
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function rating(v: unknown): number | null {
  const n = num(v);
  return n === null || n <= 0 ? null : n;
}

export class ProductUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`Product unavailable: ${reason}`);
  }
}

export function parseProduct(json: unknown, requestedId: string, now = Date.now()): ProductSnapshot {
  const resp = obj(obj(json).aliexpress_ds_product_get_response);
  if (resp.rsp_code != null && Number(resp.rsp_code) !== 200 && !resp.result) {
    throw new ProductUnavailableError(str(resp.rsp_msg) || `rsp_code ${str(resp.rsp_code)}`);
  }
  const res = obj(resp.result);
  if (!Object.keys(res).length) throw new ProductUnavailableError('empty result');
  const base = obj(res.ae_item_base_info_dto);
  const store = obj(res.ae_store_info);
  const conv = obj(res.product_id_converter_result);

  const attributes: Record<string, string> = {};
  for (const a of asArray(obj(res.ae_item_properties).ae_item_property as unknown[])) {
    const at = obj(a);
    const name = str(at.attr_name).trim();
    const value = str(at.attr_value).trim();
    if (!name || !value) continue;
    attributes[name] = attributes[name] ? `${attributes[name]}; ${value}` : value;
  }

  const skus: Sku[] = asArray(obj(res.ae_item_sku_info_dtos).ae_item_sku_info_d_t_o as unknown[]).map((s) => {
    const sk = obj(s);
    const props: Record<string, string> = {};
    let image: string | null = null;
    for (const p of asArray(obj(sk.ae_sku_property_dtos).ae_sku_property_d_t_o as unknown[])) {
      const pp = obj(p);
      const name = str(pp.sku_property_name).trim();
      const value = str(pp.property_value_definition_name || pp.sku_property_value).trim();
      if (name) props[name] = value;
      if (!image && pp.sku_image) image = str(pp.sku_image);
    }
    return {
      skuId: str(sk.sku_id),
      props,
      shipsFrom: props['Ships From'] ?? null,
      priceCents: dollarsToCents(sk.offer_sale_price),
      listPriceCents: dollarsToCents(sk.sku_price),
      stock: num(sk.sku_available_stock),
      image,
    };
  });

  const detailHtml = str(base.detail);
  const images = str(obj(res.ae_multimedia_info_dto).image_urls)
    .split(';')
    .map((u) => u.trim())
    .filter(Boolean);

  const subMap = (() => {
    try {
      return obj(JSON.parse(str(conv.sub_product_id) || '{}'));
    } catch {
      return {};
    }
  })();

  return {
    subId: str(subMap.US ?? base.product_id ?? requestedId),
    mainId: str(conv.main_product_id || base.product_id || requestedId),
    title: str(base.subject),
    status: str(base.product_status_type),
    categoryId: base.category_id != null ? str(base.category_id) : null,
    reviewCount: num(base.evaluation_count) ?? 0,
    avgRating: rating(base.avg_evaluation_rating),
    salesLabel: base.sales_count != null ? str(base.sales_count) : null,
    pooledListing: base.sl_product === true,
    store: {
      storeId: str(store.store_id),
      name: str(store.store_name),
      country: store.store_country_code ? str(store.store_country_code) : null,
      ratings: {
        asDescribed: rating(store.item_as_described_rating),
        communication: rating(store.communication_rating),
        shipping: rating(store.shipping_speed_rating),
      },
    },
    attributes,
    skus,
    images,
    descriptionImages: imagesFromDetail(detailHtml, str(base.mobile_detail)),
    descriptionText: htmlToText(detailHtml).slice(0, 4000),
    grossWeightKg: num(obj(res.package_info_dto).gross_weight),
    fetchedAt: now,
  };
}

export function parseFreight(json: unknown, skuId: string, quantity: number): FreightQuote {
  const result = obj(obj(obj(json).aliexpress_ds_freight_query_response).result);
  const opts = asArray(obj(result.delivery_options).delivery_option_d_t_o as unknown[]);
  const options: ShippingOption[] = opts.map((o) => {
    const op = obj(o);
    const free = op.free_shipping === true;
    const fee = free ? 0 : (dollarsToCents(op.shipping_fee_cent) ?? dollarsToCents(op.shipping_fee_format) ?? 0);
    return {
      carrier: str(op.company),
      code: str(op.code),
      shipFrom: op.ship_from_country ? str(op.ship_from_country) : null,
      feeCents: fee,
      free,
      minDays: num(op.min_delivery_days),
      maxDays: num(op.max_delivery_days),
      guaranteedDays: num(op.guaranteed_delivery_days),
      tracking: op.tracking === true,
    };
  });
  return {
    skuId,
    quantity,
    options,
    error: options.length ? null : str(result.msg) || 'no delivery options',
  };
}

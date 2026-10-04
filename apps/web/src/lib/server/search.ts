import 'server-only';
import {
  SORTS,
  isNew,
  toSearchDoc,
  type Facet,
  type SearchQuery,
  type SearchResult,
  type SortKey,
} from '@dolgers/shared';
import { getAllLiveProducts, getInStockSkus } from './catalog';

const host = process.env.TYPESENSE_HOST;
const key = process.env.TYPESENSE_SEARCH_KEY;

export function parseSearchParams(sp: Record<string, string | string[] | undefined>, base: Partial<SearchQuery> = {}): SearchQuery {
  const list = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? v.split(',') : []).map((s) => s.trim()).filter(Boolean).slice(0, 20);
  };
  const num = (k: string) => {
    const v = Number(Array.isArray(sp[k]) ? sp[k]![0] : sp[k]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  };
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) as SortKey | undefined;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  return {
    q: String((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '').slice(0, 100),
    categoryId: null,
    leaf: null,
    vendorId: null,
    department: null,
    sizes: list('size'),
    colours: list('colour'),
    vendors: list('brand'),
    priceMin: num('min'),
    priceMax: num('max'),
    newOnly: sp.new === '1',
    sort: sort && sort in SORTS ? sort : 'featured',
    page: Number.isInteger(page) && page > 0 && page < 100 ? page : 1,
    perPage: 24,
    ...base,
  };
}

const quote = (v: string) => '`' + v.replace(/`/g, '') + '`';

async function typesenseSearch(q: SearchQuery): Promise<SearchResult> {
  const filters = [
    q.categoryId && `categoryIds:=${quote(q.categoryId)}`,
    q.leaf && `categoryPath:=${quote(q.leaf)}`,
    q.vendorId && `vendorId:=${quote(q.vendorId)}`,
    q.department && `department:=${quote(q.department)}`,
    q.sizes.length && `sizesInStock:=[${q.sizes.map(quote).join(',')}]`,
    q.colours.length && `colour:=[${q.colours.map(quote).join(',')}]`,
    q.vendors.length && `vendorName:=[${q.vendors.map(quote).join(',')}]`,
    q.priceMin !== null && `price:>=${q.priceMin}`,
    q.priceMax !== null && `price:<=${q.priceMax}`,
    q.newOnly && 'isNew:=true',
  ].filter(Boolean);
  const sortBy = { featured: 'featured:desc,publishedAt:desc', newest: 'publishedAt:desc', 'price-asc': 'price:asc', 'price-desc': 'price:desc' }[q.sort];
  const params = new URLSearchParams({
    q: q.q || '*',
    query_by: 'title,vendorName,categoryLeaf,colour',
    filter_by: filters.join(' && '),
    facet_by: 'sizesInStock,colour,vendorName',
    max_facet_values: '50',
    sort_by: q.q ? `_text_match:desc,${sortBy}` : sortBy,
    page: String(q.page),
    per_page: String(q.perPage),
  });
  const url = `${host!.includes('://') ? host : `https://${host}`}/collections/products/documents/search?${params}`;
  const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': key! }, next: { revalidate: 60, tags: ['search'] } });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facet = (name: string): Facet[] => (body.facet_counts ?? []).find((f: any) => f.field_name === name)?.counts.map((c: any) => ({ value: c.value, count: c.count })) ?? [];
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hits: body.hits.map((h: any) => h.document),
    found: body.found,
    page: q.page,
    perPage: q.perPage,
    facets: { sizes: facet('sizesInStock'), colours: facet('colour'), vendors: facet('vendorName') },
  };
}

/** Same behaviour as the Typesense query, over the cached catalog. Fine for a few thousand products. */
async function memorySearch(q: SearchQuery): Promise<SearchResult> {
  const t = Date.now();
  const [products, skus] = await Promise.all([getAllLiveProducts(), getInStockSkus()]);
  const inStock = new Set(skus);
  const all = products.map((p) => toSearchDoc(p, p.variants.filter((v) => inStock.has(v.sku)).map((v) => v.size), t));
  const words = q.q.toLowerCase().split(/\s+/).filter(Boolean);
  const base = all.filter((d) =>
    (!q.categoryId || d.categoryIds.includes(q.categoryId)) &&
    (!q.leaf || d.categoryPath.includes(q.leaf)) &&
    (!q.vendorId || d.vendorId === q.vendorId) &&
    (!q.department || d.department === q.department) &&
    (!q.newOnly || d.isNew) &&
    words.every((w) => `${d.title} ${d.vendorName} ${d.categoryLeaf} ${d.colour}`.toLowerCase().includes(w)));

  const match = (d: (typeof all)[number], skip?: 'sizes' | 'colours' | 'vendors') =>
    (skip === 'sizes' || !q.sizes.length || d.sizesInStock.some((s) => q.sizes.includes(s))) &&
    (skip === 'colours' || !q.colours.length || q.colours.includes(d.colour)) &&
    (skip === 'vendors' || !q.vendors.length || q.vendors.includes(d.vendorName)) &&
    (q.priceMin === null || d.price >= q.priceMin) &&
    (q.priceMax === null || d.price <= q.priceMax);

  const count = (values: string[]) => {
    const m = new Map<string, number>();
    values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
    return [...m].map(([value, c]) => ({ value, count: c }));
  };
  const hits = base.filter((d) => match(d));
  const sorters: Record<SortKey, (a: typeof hits[number], b: typeof hits[number]) => number> = {
    featured: (a, b) => Number(b.featured) - Number(a.featured) || b.publishedAt - a.publishedAt,
    newest: (a, b) => b.publishedAt - a.publishedAt,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
  };
  hits.sort(sorters[q.sort]);
  const start = (q.page - 1) * q.perPage;
  return {
    hits: hits.slice(start, start + q.perPage),
    found: hits.length,
    page: q.page,
    perPage: q.perPage,
    facets: {
      sizes: count(base.filter((d) => match(d, 'sizes')).flatMap((d) => d.sizesInStock)),
      colours: count(base.filter((d) => match(d, 'colours')).map((d) => d.colour)),
      vendors: count(base.filter((d) => match(d, 'vendors')).map((d) => d.vendorName)),
    },
  };
}

export async function searchProducts(q: SearchQuery): Promise<SearchResult> {
  if (host && key) {
    try {
      return await typesenseSearch(q);
    } catch (err) {
      console.error('Typesense unavailable, falling back to in-memory search', err);
    }
  }
  return memorySearch(q);
}

export { isNew };

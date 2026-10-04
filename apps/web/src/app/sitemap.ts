import type { MetadataRoute } from 'next';
import { getAllLiveProducts, getCategories, getVendors } from '@/lib/server/catalog';
import { publicEnv } from '@/lib/env';

export const revalidate = 3600;

const STATIC = [
  '', '/new-in', '/shop', '/shoes', '/accessories', '/brands', '/sell', '/about', '/journal', '/careers',
  '/help/delivery', '/help/returns', '/help/size-guide', '/help/contact', '/privacy', '/terms', '/accessibility',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path || '/', publicEnv.siteUrl).toString();
  const [categories, products, vendors] = await Promise.all([getCategories(), getAllLiveProducts(), getVendors()]);
  return [
    ...STATIC.map((p) => ({ url: url(p), changeFrequency: (p === '' || p === '/new-in' ? 'daily' : 'monthly') as 'daily' | 'monthly', priority: p === '' ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: url(`/shop/${c.path.join('/')}`), changeFrequency: 'daily' as const, priority: c.path.length === 1 ? 0.9 : 0.7 })),
    ...vendors.map((v) => ({ url: url(`/brands/${v.slug}`), lastModified: new Date(v.updatedAt), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...products.map((p) => ({
      url: url(`/products/${p.slug}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: p.images.filter((i) => i.url).map((i) => i.url),
    })),
  ];
}

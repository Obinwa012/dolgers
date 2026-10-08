import type { MetadataRoute } from 'next';
import { liveProducts } from '@/lib/catalog';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? 'http://localhost:3000';
  const products = await liveProducts();
  return [
    { url: `${site}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/men`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${site}/women`, changeFrequency: 'daily', priority: 0.8 },
    ...products.map((p) => ({ url: `${site}/products/${p.handle}`, lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined, priority: 0.7 })),
  ];
}

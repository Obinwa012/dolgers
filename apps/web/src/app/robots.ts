import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/checkout', '/vendor', '/admin', '/api', '/bag', '/search', '/sign-in'] }],
    sitemap: new URL('/sitemap.xml', publicEnv.siteUrl).toString(),
  };
}

import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// This app is deployed on its own (App Hosting root directory = apps/web) with its own lockfile.
// Pinning the tracing root here keeps the standalone server at .next/standalone/server.js,
// where App Hosting's Next.js adapter looks for it, instead of nesting it under the monorepo path.
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// App Hosting provides the Firebase web app config as FIREBASE_WEBAPP_CONFIG at build time. The
// browser needs it to sign in with Firebase Auth; these values are public identifiers, not secrets.
function firebaseWebEnv(): Record<string, string> {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return {};
  try {
    const c = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG ?? '') as Record<string, string>;
    return {
      NEXT_PUBLIC_FIREBASE_API_KEY: c.apiKey ?? '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: c.authDomain ?? '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: c.projectId ?? '',
      NEXT_PUBLIC_FIREBASE_APP_ID: c.appId ?? '',
    };
  } catch {
    return {};
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.alicdn.com https://*.aliexpress-media.com https://*.aliexpress.com",
  "font-src 'self' data:",
  // Firebase Auth sign-in (and the local Auth emulator during development).
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${isDev || process.env.NEXT_PUBLIC_AUTH_EMULATOR ? ' http://127.0.0.1:9099 http://localhost:9099' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  // Connect AliExpress redirects the browser to AliExpress's authorization page.
  "form-action 'self' https://api-sg.aliexpress.com",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
  poweredByHeader: false,
  devIndicators: false,
  env: firebaseWebEnv(),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;

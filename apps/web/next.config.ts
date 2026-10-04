import type { NextConfig } from 'next';

// Firebase App Hosting provides the web app config as FIREBASE_WEBAPP_CONFIG at build time.
// Expose it to the browser bundle as NEXT_PUBLIC_* values (these are public identifiers, not secrets).
function firebaseWebEnv(): Record<string, string> {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw || process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return {};
  try {
    const c = JSON.parse(raw) as Record<string, string>;
    return {
      NEXT_PUBLIC_FIREBASE_API_KEY: c.apiKey ?? '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: c.authDomain ?? '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: c.projectId ?? '',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: c.storageBucket ?? '',
      NEXT_PUBLIC_FIREBASE_APP_ID: c.appId ?? '',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: c.messagingSenderId ?? '',
    };
  } catch {
    return {};
  }
}

const isDev = process.env.NODE_ENV === 'development';

// A static policy keeps catalog pages cacheable at the CDN (a per-request nonce would force every
// page to render on demand). React escapes all rendered text and the site never renders
// vendor-supplied HTML, which is the main XSS defence; this policy limits what an injected script
// could load or send.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.stripe.com https://lh3.googleusercontent.com http://127.0.0.1:9199 http://localhost:9199",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://*.run.app https://api.stripe.com https://*.typesense.net https://www.google.com/recaptcha/ http://127.0.0.1:* http://localhost:* ws://localhost:* ws://127.0.0.1:*",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com/recaptcha/ https://recaptcha.google.com https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: ['@dolgers/shared'],
  poweredByHeader: false,
  env: firebaseWebEnv(),
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};

export default nextConfig;

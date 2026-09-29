import type { NextConfig } from "next";

/**
 * Firebase App Hosting provides the web app config as FIREBASE_WEBAPP_CONFIG (JSON) at build time.
 * Map it onto the NEXT_PUBLIC_FIREBASE_* names the app reads, so a deploy needs no copied keys.
 * Values already set in the environment (e.g. .env.local) win.
 */
function firebaseWebEnv(): Record<string, string> {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  try {
    const c = JSON.parse(raw) as Record<string, string | undefined>;
    const map: Record<string, string | undefined> = {
      NEXT_PUBLIC_FIREBASE_API_KEY: c.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: c.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: c.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: c.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: c.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: c.appId,
    };
    return Object.fromEntries(
      Object.entries(map).filter((e): e is [string, string] => Boolean(e[1]) && !process.env[e[0]]),
    );
  } catch {
    return {};
  }
}

const nextConfig: NextConfig = {
  env: firebaseWebEnv(),
};

export default nextConfig;

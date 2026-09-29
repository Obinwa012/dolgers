import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Stripe client, or null when STRIPE_SECRET_KEY isn't set (demo mode). */
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

/**
 * Orders without payment are only allowed when explicitly enabled, or in `next dev`.
 * In production with no Stripe key, checkout refuses rather than silently giving goods away.
 */
export const demoCheckoutAllowed = () =>
  process.env.CHECKOUT_DEMO_MODE === "true" || process.env.NODE_ENV === "development";

/** Absolute site URL for Stripe redirects. Prefer the configured URL over the request's Host header. */
export function siteUrl(request: Request): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

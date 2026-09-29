# Code review: findings and status (Sept 2026)

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | Orders were built in the browser and the Firestore rule only checked `uid`, so any signed-in user could write an order with any price, total or status. `FIRSTBUILD` was reusable on every order. | **Fixed**: `/api/checkout` prices server-side; clients can't create orders; Stripe webhook is the only path to `paid`; first-order check enforced. |
| 2 | High | Open redirect after login: `?next=/\evil.com` passed the `startsWith("/")` check and browsers resolve it to `https://evil.com`. | **Fixed**: `safeNext()` in `AuthForm.tsx` resolves the URL and compares origins. |
| 3 | Medium | Newsletter: a second signup showed the raw "Missing or insufficient permissions" error. Rule didn't bind doc id to email or type-check `createdAt`. | **Fixed**: duplicate treated as success (same message, so no address probing); rule tightened. |
| 4 | Medium | Cart wiped on every reload in `next dev` (StrictMode + a ref-based "hydrated" flag let the persist effect write `[]` over the saved cart). | **Fixed** (`hydrated` is now state). |
| 5 | Medium | Footer email input was white text on white (inherited `text-white`). | **Fixed** in `.input`. |
| 6 | Low | Log out on /account landed on `/login?next=/account` (redirect effect raced `router.push("/")`). | **Fixed**. |
| 7 | Low | Signing out left the account's cart/wishlist in localStorage (shared computers). | **Fixed**: cleared on sign-out; restored from Firestore on next sign-in. |
| 8 | Low | Stock never enforced; "Only 0 left" could show with an active Add button. | **Fixed**: checked at checkout (per product, across variants), decremented by webhook; out-of-stock UI. |
| 9 | Visual | Rail progress bars started at 30% width regardless of content; brand row clipped at desktop; Featured tabs ignored the `featured` tag and repeated New Arrivals; battery icon rendered as an empty box; promo/deal copy contradicted the catalog (brunn badge on a Voltra link, "Save $40" on a non-sale item, "Up to 30%" vs max 20%). | **Fixed**. |
| 10 | Low | Mobile menu didn't close on Esc or lock background scroll; marquee ignored reduced-motion. Wishlist cards had no brand badges. | **Fixed**. |

## Still open (not changed)
- **Whole catalog is serialized into every page** (`layout.tsx` → `ShopProvider`). Fine at 18 products; at a few hundred, ship a slim `{id, slug, title, variants, icon, tint, image}` map or fetch cart lines on demand.
- **Product/blog pages render on demand** (`ƒ` in the build output). Adding `generateStaticParams` would prerender them.
- **No rate limiting on `/api/checkout`**. Each call creates a pending order and a Stripe session. Consider App Check or a per-uid limit if abused.
- **`users/{uid}` docs are unvalidated** (owner can write arbitrary fields/sizes to their own doc). Low risk; add shape checks if the doc grows.
- **Sales tax** isn't calculated.

## How it was verified
- `npm test`: 6 unit tests on pricing/validation (forged prices ignored, cents rounding, first-order code, stock across variants, quantity caps).
- Against the Firebase emulators: 11 security-rule checks; 9 checkout-API checks (auth, forged totals, bad codes, stock, address); 9 signed-webhook checks (bad signature, paid, stock decrement, idempotent retries, no downgrade after paid, amount-mismatch flag, expiry → canceled); browser E2E of register → checkout → account → logout → newsletter, and the post-Stripe success page.
- **Not verified:** creating a real Stripe Checkout Session (no Stripe key was available; the request reached Stripe's API and was rejected for the placeholder key, and the pending order was cleaned up). Do DEPLOY.md step 2 once with test keys.

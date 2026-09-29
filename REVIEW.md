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

## Marketplace and storefront redesign (Sept 2026)

Verified:
- `npm test`: 19 unit tests (adds bundle pricing, order splitting/commission, transfer reversals, return
  rules and transitions, application/listing/tracking validation, filters, delivery dates, specs,
  frequently-bought-together, compare, and catalog integrity).
- 47 end-to-end checks against the Firebase emulators and `next dev` (demo checkout): apply → email
  verification required → admin approve (custom commission) → list → edit price/stock → unlist blocks
  checkout → multi-seller checkout creates per-seller orders → ship with tracking → return → reject →
  escalate → admin refund → seller share deducted; plus cross-account checks (can't edit others'
  listings, ship others' orders, return others' orders, read `sellerAccounts`, write applications or
  products) and the `questions` create rule.
- Browser: every new page at 1440px and 390px with no console/hydration errors and no horizontal
  overflow. This caught a white-on-white card title in the dark clearance band (fixed) and an
  announcement bar claiming "up to 40% off kits" when the deepest kit discount is 28% (copy fixed).

**Not verified:** anything that needs real Stripe keys: Connect onboarding, transfers, refunds and
transfer reversals, and dispute webhooks. Those paths ran only in demo mode (no Stripe), where
payouts are recorded as `not_configured` and refunds as `demo_refund`. Do DEPLOY.md step 4b with test
keys and run one order through ship → return before going live.

Known trade-offs:
- Seller answers and listings write to `products` with the Admin SDK; the storefront picks them up on
  the next ISR revalidation (≤ 5 min).
- A refund on an order with a discount is capped at what was actually charged, but concurrent refunds
  on the same order aren't serialised; Stripe rejects an over-refund, which surfaces as a "refund
  failed" row with a retry button on `/admin`.
- Delivery dates are estimates (handling days + 2–4 business days' transit, 2pm CT cutoff), with no
  carrier integration or holiday calendar.

## Still open (not changed)
- **Whole catalog is serialized into every page** (`layout.tsx` → `ShopProvider`), now including Q&A and spec tables. Fine at 30 products; with marketplace sellers adding listings this becomes the first scaling problem. Ship a slim `{id, slug, title, variants, icon, tint, image, seller, subcategory}` map instead.
- **Product/blog pages render on demand** (`ƒ` in the build output). Adding `generateStaticParams` would prerender them.
- **No rate limiting on `/api/checkout`**. Each call creates a pending order and a Stripe session. Consider App Check or a per-uid limit if abused.
- **`users/{uid}` docs are unvalidated** (owner can write arbitrary fields/sizes to their own doc). Low risk; add shape checks if the doc grows.
- **Sales tax** isn't calculated.

## How it was verified
- `npm test`: 6 unit tests on pricing/validation (forged prices ignored, cents rounding, first-order code, stock across variants, quantity caps).
- Against the Firebase emulators: 11 security-rule checks; 9 checkout-API checks (auth, forged totals, bad codes, stock, address); 9 signed-webhook checks (bad signature, paid, stock decrement, idempotent retries, no downgrade after paid, amount-mismatch flag, expiry → canceled); browser E2E of register → checkout → account → logout → newsletter, and the post-Stripe success page.
- **Not verified:** creating a real Stripe Checkout Session (no Stripe key was available; the request reached Stripe's API and was rejected for the placeholder key, and the pending order was cleaned up). Do DEPLOY.md step 2 once with test keys.

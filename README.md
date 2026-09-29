# Torqline: Tool Store (Next.js + Tailwind + Firebase)

A tool-store storefront. Its section layout follows a typical industrial-tools theme: marquee
announcement bar, two-tier header, hero, perks strip, promo mosaic, category circles, top deals,
product rails, featured tabs, reviews, brand tiles, blog, and footer. The brand, products, copy and
artwork are all original placeholders. Swap in your own.

## Stack
- Next.js 16 (App Router, server components, ISR every 5 min)
- Tailwind CSS v4 (theme tokens in `src/app/globals.css`)
- Firebase Auth (email/password, Google, password reset)
- Cloud Firestore (catalog, carts, wishlists, orders, newsletter)
- Stripe Checkout (server-side pricing in `/api/checkout`, orders confirmed by `/api/stripe/webhook`)

## Run it
```bash
npm install
cp .env.local.example .env.local   # fill in your Firebase web config
npm run dev
```
The site works without Firebase too: it uses the bundled catalog in `src/data/catalog.ts`,
and the cart and wishlist fall back to localStorage. Auth, checkout and the newsletter need Firebase
(the local emulators are enough; see [DEPLOY.md](DEPLOY.md) step 0).

`npm test` runs the checkout pricing/validation tests.

**Deploying:** see [DEPLOY.md](DEPLOY.md) (Firebase App Hosting + Stripe).

## Firebase setup
1. Create a project → add a **Web app** → copy the config into `.env.local`.
2. **Authentication** → enable *Email/Password* and *Google*. Add your domain under *Authorized domains*.
3. **Firestore** → create the database, then deploy rules and indexes:
   ```bash
   npm i -g firebase-tools && firebase login && firebase use <project-id>
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Seed the catalog (optional; the bundled data is used until you do). Download a service-account key
   (Project settings → Service accounts), save it as `service-account.json`, then run `npm run seed`.

## Checkout
The browser sends only product ids, quantities, the discount code and the address to
`POST /api/checkout`. The server verifies the Firebase ID token, prices the cart from the catalog
(`src/lib/server/checkout-core.ts`, shared rules in `src/lib/pricing.ts`), checks stock and
first-order codes, writes the order with the Admin SDK, and redirects to Stripe Checkout. The Stripe
webhook marks it `paid` and decrements stock. Without `STRIPE_SECRET_KEY`, checkout runs in demo mode
in `next dev` (or with `CHECKOUT_DEMO_MODE=true`) and refuses in production.

## Firestore data model
| Collection | Access | Notes |
|---|---|---|
| `products`, `categories`, `brands`, `posts` | public read, admin write | doc id = slug |
| `users/{uid}` | owner only | `{ name, email, cart[], wishlist[] }` |
| `orders/{id}` | owner read; **server-only writes** | created by `/api/checkout`, updated by the Stripe webhook |
| `subscribers/{email}` | create-only, validated | newsletter |

"Admin" means a custom claim `admin: true` (set it with the Admin SDK).

## Real product photos
Set `image` on a product (any URL) and it replaces the generated icon art.

## Not included yet
- Sales tax (Stripe Tax can be switched on in the Checkout Session; see DEPLOY.md).
- Order emails beyond Stripe's receipt, and shipping/fulfilment status updates.
- An admin dashboard for editing products and orders (use the Firebase console or the seed script).
- Quick-view modal and product compare.

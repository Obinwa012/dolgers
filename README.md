# Dolgers: Women's Fashion Store (Next.js + Tailwind + Firebase)

A promotion-driven women's clothing store with a marketplace-style (Taobao-inspired) storefront and with a third-party marketplace. Storefront: marquee announcement bar,
two-tier header with a mega menu, rotating hero carousel, deals by category, top deals, bundle offers,
clearance, dense product grids (rating, price, delivery date or pickup and seller on every card),
faceted filters, and deep product pages (full specs, Q&A, frequently bought together, comparison,
financing message, seller and returns/warranty policy). Marketplace: seller applications, an admin
approval console, a seller dashboard (listings, orders and tracking, returns, questions), Stripe
Connect payouts with automatic commission, and a returns/escalation workflow. The brand, products,
sellers, copy and artwork are all original placeholders. Swap in your own.

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

`npm test` runs the pricing, checkout, marketplace and filter unit tests.

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
| `sellers/{slug}` | public read, admin write | public seller profile (name, rating, handling time, return/warranty policy) |
| `sellerAccounts/{slug}` | **no client access** | owner uid, Stripe Connect account, commission rate |
| `sellerApplications/{uid}` | owner read; server-only writes | via `POST /api/seller {action:"apply"}`; approved on `/admin` |
| `sellerOrders/{orderId_seller}` | customer reads own; server-only writes | one seller's share of a paid order: items, tracking, commission, payout status |
| `returns/{id}` | customer reads own; server-only writes | requested → approved/rejected → escalated → resolved |
| `questions/{id}` | signed-in create, validated | product questions; the seller's answer is copied onto `products/{id}.qa` |

"Admin" means a custom claim `admin: true` (set it with the Admin SDK). Staff use `/admin`.

## Marketplace
- **Who sells what:** `product.seller` (missing = Dolgers). Cards and product pages show "Sold by", the
  seller's rating, and who handles returns and warranty (`seller.returns`, `seller.warranty`).
- **Money:** customers pay Dolgers in one Stripe Checkout (separate charges and transfers). The
  webhook splits each paid order into `sellerOrders`. When a seller enters tracking, their net
  (item prices minus `COMMISSION_RATE`, 12% by default, per-seller override) is transferred to their
  Stripe Connect account, funded from the customer's charge. Discount codes, bundle savings and
  shipping are Dolgers's. Refunds claw back the seller's proportional share.
- **Identity and business checks** happen in Stripe Connect Express onboarding (started from the seller
  dashboard). Dolgers's own application form deliberately collects no tax IDs or bank details.
- **Returns:** customer requests from *My account* → seller approves (refund issued) or rejects with a
  reason → customer can escalate a rejection, or a request unanswered for 3 days → Dolgers decides on
  `/admin`. Card disputes (`charge.dispute.created`) flag the order for review.
- **Bundles** (`BUNDLES` in `src/lib/pricing.ts`) are priced server-side like discount codes.
- **Financing** copy on product pages is a placeholder (`FINANCING` in `src/lib/shopping.ts`): turn on a
  pay-over-time method in Stripe and make the terms match before relying on it.

## Real product photos
Set `image` on a product (any URL) and it replaces the generated icon art.

## Not included yet
- Sales tax (Stripe Tax can be switched on in the Checkout Session; see DEPLOY.md). Marketplace
  facilitator tax rules may apply once third parties sell through you.
- Emails: order confirmation beyond Stripe's receipt, seller notifications (new order, return, question),
  application decisions.
- Seller ratings are static numbers; there's no review collection yet.
- Seller image uploads (listings use generated art), per-seller shipping rates, delivered/delivery
  tracking via carrier APIs, seller-editable profile.
- Quick-view modal.

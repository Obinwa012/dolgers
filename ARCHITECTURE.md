# Architecture

## The shape

```
Shopper / vendor / admin browser
  │  pages, images (CDN-cached)               │ sign-in, own profile/wishlist (rules-checked)
  ▼                                           ▼
Firebase App Hosting (Next.js)          Firebase Auth + Firestore (client SDK)
  │ server reads (read-only)                  ▲
  ▼                                           │ callable functions (App Check + auth + zod)
Firestore ◄──── Cloud Functions ──────────────┘
                 │        │        │
               Stripe  Typesense  Storage (image pipeline)
```

- **The website never writes business data.** Its server reads Firestore with a read-only service
  account and caches pages at the CDN. Everything that touches money, stock, roles or another
  person's data is a Cloud Function that checks App Check, the caller's role, the input (shared zod
  schemas) and a Firestore-backed rate limit, then writes with the Admin SDK and an audit entry.
- **Clients write only their own profile, addresses, wishlist and follows**, and the security rules
  validate the shape of each. Roles (`admin`, `vendorId`) are custom claims only Functions can set.
- **Search is Typesense**, kept in sync by Firestore triggers. Firestore cannot do the faceted
  filtering the shop pages need (size + colour + maker + price together). If Typesense is not
  configured the website filters the catalog in memory, which is fine for development and small
  catalogs only.

## Data model (Firestore, `nam5`)

| Collection | Written by | Notes |
| --- | --- | --- |
| `categories`, `content/home` | Admin functions | Public read. |
| `vendors/{id}` (+ `members`) | Functions | Public storefront; hidden when suspended. |
| `vendorPrivate/{id}` | Functions | Stripe account status, commission. Vendor + admin read. |
| `vendorApplications/{uid}` | Functions | One per account. |
| `products/{id}` | Vendor functions | Variants (size, SKU, price) embedded. Public only when `live`. |
| `inventory/{sku}` | Functions | `onHand` and `reserved`. Separate from products so stock changes don't rewrite or re-cache the product. |
| `orders/{id}` | Checkout + webhook | Lines frozen at the price paid. |
| `vendorOrders/{orderId}_{vendorId}` | Functions | Each maker's part of an order: what they ship and what they're paid. |
| `returns/{id}`, `ledger/{id}`, `auditLog/{id}` | Functions | Ledger is append-only: every charge, commission, transfer, refund, dispute. |
| `users/{uid}` (+ `addresses`, `wishlist`, `follows`) | The shopper | Rules-validated. |
| `promoCodes`, `rateLimits`, `stripeEvents`, `mail`, `subscribers` | Functions | Server-only. |

Money is integer cents everywhere. Timestamps are epoch milliseconds.

## Checkout and payments

1. The bag lives in the browser. `/api/cart/quote` prices it on the server from live data.
2. `createCheckout` re-prices inside a Firestore transaction, **reserves stock for 30 minutes**,
   creates a `pending_payment` order and a Stripe PaymentIntent (idempotency key = order id), and
   returns the client secret. The page shows Stripe's embedded **Payment Element**: card details
   go straight to Stripe and never touch DOLGERS servers, which keeps PCI scope at SAQ A.
3. The **Stripe webhook** (signature-verified, each event processed once) marks the order paid,
   converts reservations into sales, splits it into `vendorOrders`, writes the ledger and queues
   emails. `releaseExpiredReservations` (every 10 minutes) frees stock from abandoned checkouts.
4. **Stripe Connect Express, separate charges and transfers.** The platform takes the payment; each
   vendor is paid by a transfer **when they mark their part shipped**: subtotal minus their share of
   any discount minus commission (default 15%). DOLGERS keeps shipping and tax. A refund reverses
   the vendor's transfer proportionally.

Consequences to be aware of: under separate charges the **platform is the merchant of record**, so
chargebacks and Stripe fees land on DOLGERS first, and as a marketplace facilitator DOLGERS is
responsible for US sales tax in most states. Stripe Tax is wired in (`STRIPE_TAX_ENABLED`) but off
until a tax registration plan exists.

## Security posture

No system is attack-proof; the aim is to make attacks expensive and limit the damage of any one
failure.

- **Least privilege:** read-only website identity; Functions are the only writers; default-deny rules
  with tests (`firebase/tests`); custom claims for roles.
- **Abuse:** App Check (reCAPTCHA Enterprise) on every callable, per-user/IP rate limits, App Hosting
  and Functions `maxInstances` caps so a traffic flood hits a ceiling instead of the bill.
- **Input:** one set of zod schemas validates every action; user text is never rendered as HTML.
- **Uploads:** images only, into the uploader's own folder; a function re-encodes each one (strips
  metadata and hidden payloads) and publishes fixed sizes.
- **Headers:** strict Content-Security-Policy (Stripe and Firebase allow-listed), HSTS, frame-ancestors
  none, nosniff, a restrictive Permissions-Policy. The CSP is static rather than nonce-based so pages
  stay CDN-cacheable.
- **Payments:** card data handled only by Stripe; webhook signatures verified; idempotent handlers.
- **Audit:** every admin action and money movement is recorded.

Still to do on the console side (see DEPLOY.md): MFA for admin accounts (Identity Platform),
budget alerts, and Cloud Armor if bot traffic warrants it.

## Scaling

Firestore, Functions, App Hosting and Typesense all scale horizontally with no servers to manage.
The limits that matter in practice:

- **Hot documents:** a single Firestore document sustains about one write per second. Counters
  that many people bump (a vendor's follower count) are updated by triggers, not in user requests.
  A best-selling SKU's inventory document is the known hotspot; if a drop ever sells hundreds of
  units a second, switch that SKU to sharded stock.
- **Caching:** product, vendor and category pages are cached and revalidated by tag when Functions
  change them, so traffic spikes mostly hit the CDN, not Firestore.
- **Cost, not capacity, is the real risk.** Instance caps and budget alerts are the guard rails.

## Decisions log

- Firebase App Hosting rather than Vercel: one cloud, one IAM model, server reads with Google
  service-account identity, no extra vendor.
- Firestore rather than Realtime Database: queries, transactions and per-document rules.
- Variants embedded in the product; stock in its own collection.
- Vendor and admin pages are client-rendered and rely on rules and callables, not page-level checks.

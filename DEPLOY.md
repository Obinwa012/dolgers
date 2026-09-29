# Deploying Torqline

Target: **Firebase App Hosting** (runs Next.js server features: API routes, ISR) + Firestore + Auth + Stripe.
Steps marked 👤 need your accounts; everything else is already configured in this repo.

## 0. Try it locally first (no accounts needed)

```bash
npm install
npx firebase-tools emulators:start --project demo-torqline   # Auth + Firestore, UI at :4000
cp .env.local.example .env.local   # then use the "Local emulators" block at the bottom
npm run dev
```
With no `STRIPE_SECRET_KEY`, checkout runs in demo mode (orders saved, no payment).
`npm test` runs the checkout pricing tests.

## 1. 👤 Firebase project

1. Create a project at https://console.firebase.google.com and upgrade to the **Blaze** plan
   (App Hosting requires it; small stores typically stay within free-tier usage).
2. **Build → Authentication**: enable *Email/Password* and *Google*.
3. **Build → Firestore Database**: create it (production mode).
4. **Project settings → Your apps**: add a **Web app**.
5. Deploy rules and indexes, then seed the catalog:
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add            # pick your project
   firebase deploy --only firestore:rules,firestore:indexes
   # Service account key for seeding (keep it out of git; it's in .gitignore):
   #   Project settings → Service accounts → Generate new private key → save as service-account.json
   npm run seed
   ```
   > Once seeded, Firestore is the catalog of record: the checkout API prices orders from it and the
   > webhook decrements `stock` there. Edit products in the console (or re-run the seed).

## 2. 👤 Stripe

1. Get test keys: https://dashboard.stripe.com/test/apikeys
2. Local testing with real Stripe (test mode):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints whsec_...
   ```
   Put `STRIPE_SECRET_KEY=sk_test_...` and that `STRIPE_WEBHOOK_SECRET` in `.env.local`, restart
   `npm run dev`, and pay with card `4242 4242 4242 4242`, any future date, any CVC.

## 3. 👤 App Hosting backend

```bash
firebase apphosting:backends:create --backend torqline --primary-region us-central1
```
Connect your GitHub repo when prompted (root directory `/`, live branch `main`). Every push to `main`
then builds and rolls out. The backend URL looks like `https://torqline--<project>.<region>.hosted.app`.

Put that URL in `apphosting.yaml` → `SITE_URL`, then create the secrets:

```bash
firebase apphosting:secrets:set STRIPE_SECRET_KEY        # paste sk_test_... (sk_live_... later)
firebase apphosting:secrets:set STRIPE_WEBHOOK_SECRET    # from step 4
firebase apphosting:secrets:grantaccess STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET --backend torqline
```

No Firebase keys to copy: App Hosting injects the web config at build (mapped in `next.config.ts`),
and the backend's service account already has Admin SDK access for the checkout API.

## 4. 👤 Stripe webhook (production)

Stripe Dashboard → Developers → Webhooks → **Add endpoint**
- URL: `https://<your-backend-url>/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.dispute.created`
- Copy the signing secret (`whsec_...`) into the `STRIPE_WEBHOOK_SECRET` secret, then push (or
  roll out from the console) so the backend picks it up.

## 4b. 👤 Marketplace payouts (Stripe Connect)

1. Stripe Dashboard → **Connect** → get started, choose the **platform** model, and enable
   **Express** accounts. Fill in the platform profile (Stripe reviews it).
2. Under Connect settings, set your branding and the redirect domains (your backend URL).
3. Nothing else to configure in code: sellers start onboarding from `/seller` (identity, business and
   bank checks happen on Stripe), and payouts go out as transfers when they ship.
4. Make yourself staff: set the custom claim once with the Admin SDK, e.g.
   `getAuth().setCustomUserClaims("<your uid>", { admin: true })`, then sign out and in. Approve
   sellers on `/admin`.

> Transfers use `source_transaction`, so the platform and connected accounts must be in the same
> region (US platform → US sellers). Cross-border sellers need Stripe's "recipient" service agreement.

## 5. 👤 Authorized domains

Authentication → Settings → **Authorized domains**: add the `*.hosted.app` URL and any custom domain,
or Google sign-in popups will fail there.

## 6. Go-live checklist

- [ ] Place a test-mode order end to end; confirm it shows **Paid** in *My account* and stock dropped.
- [ ] Swap to live keys (`sk_live_...`) and a live-mode webhook endpoint + secret.
- [ ] Replace placeholder pages (`src/app/pages/[slug]`): privacy policy, shipping, returns.
- [ ] Decide on sales tax: not calculated today. Stripe Tax can be enabled on the Checkout Session
      (`automatic_tax: { enabled: true }`) once your tax registrations are set up.
- [ ] Custom domain: App Hosting → your backend → Settings → Domains; then update `SITE_URL` and
      Authorized domains.
- [ ] Watch for orders with a `needsReview` field (amount mismatch, oversold stock, reused first-order code,
      card disputes). They're listed on `/admin`.
- [ ] Replace the placeholder financing message, or remove it, before launch (see README → Marketplace).
- [ ] Write seller terms (commission, handling times, return obligations, payout reversals) and link them
      from `/sell`.

## Order lifecycle

```
cart ──POST /api/checkout──▶ order: pending_payment ──Stripe Checkout──▶ webhook ──▶ paid (stock −qty)
                                     │                                        │    └─▶ sellerOrders (one per seller)
                                     │                                        └──▶ payment_failed
                                     └──── session expires (1 h) ─────────────────▶ canceled

sellerOrder: awaiting_shipment ──seller enters tracking──▶ shipped ──▶ Stripe transfer (net of commission)
return: requested ──seller──▶ approved (refund + reversal) | rejected ──customer──▶ escalated ──admin──▶ resolved
```
Clients can read their own orders but can't create or edit any (see `firestore.rules`).

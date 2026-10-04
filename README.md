# DOLGERS

A curated menswear marketplace: independent makers and brands sell to shoppers in the United States,
in US dollars, through one storefront and one checkout.

| Part | What it is |
| --- | --- |
| `apps/web` | The website: Next.js 16 (App Router) + Tailwind CSS 4, hosted on Firebase App Hosting. Storefront, bag and checkout, shopper accounts, vendor dashboard, admin console. |
| `functions` | Cloud Functions (2nd gen): checkout and Stripe payments, the Stripe webhook, vendor and admin actions, search indexing, image processing, scheduled clean-up. **Every write that matters happens here.** |
| `packages/shared` | Types, pricing, validation schemas and the demo catalog, used by both. |
| `firebase` | Firestore and Storage security rules, indexes, and the rules tests. |

Read [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit and why, and [DEPLOY.md](DEPLOY.md)
to put it live.

## Run it locally

Requires Node 22+ and Java 21 (for the Firebase emulators).

```bash
npm install
```

**Quickest look (no Firebase):** `npm run dev` and open http://localhost:3000. With no Firebase
settings the site runs on the bundled demo catalog from the mockup. Browsing, search and the bag
work; sign-in, checkout and dashboards need the emulators.

**Full local stack:**

```bash
cp apps/web/.env.example apps/web/.env.local     # points the site at the emulators
cp functions/.secret.local.example functions/.secret.local   # add a Stripe TEST secret key
npm run emulators            # terminal 1: Auth, Firestore, Functions, Storage (UI on :4000)
npm run seed                 # terminal 2: loads the catalog and test accounts
npm run dev                  # terminal 3: the website on :3000
```

Seeded accounts (password `password123`):

| Email | Role |
| --- | --- |
| `admin@dolgers.test` | Admin console at `/admin` |
| `vendor@dolgers.test` | Owner of Nordhavn, vendor dashboard at `/vendor` |
| `shopper@dolgers.test` | Shopper |

Promo code `WELCOME10` gives 10% off. Pay with Stripe's test card `4242 4242 4242 4242`. To see
orders move to "paid" locally, forward webhooks with the Stripe CLI:
`stripe listen --forward-to http://127.0.0.1:5001/demo-dolgers/us-central1/stripeWebhook`.

## Checks

```bash
npm run typecheck    # all workspaces
npm run lint         # website
npm test             # pricing and functions unit tests
npm run test:rules   # security rules against the emulators
npm run build        # shared, website, functions
```

CI runs all of these on every pull request (`.github/workflows/ci.yml`).

# Deploying DOLGERS

Two Firebase projects are expected: `dolgers-staging` and `dolgers-prod` (see `.firebaserc`). Do
everything on staging first with Stripe **test** keys.

## 1. Firebase project

1. Create the project on the **Blaze** plan and set a **budget alert** (Billing → Budgets) before
   anything else.
2. Firestore: create the database in **`nam5`** (multi-region US).
3. Authentication: enable Email/Password (and Google if wanted). Upgrade to **Identity Platform** and
   turn on **MFA**; require it for admin accounts.
4. App Check: register the web app with **reCAPTCHA Enterprise**; note the site key. Enforce App
   Check for Firestore and Storage once the site is live and verified.
5. Storage: create the default bucket.
6. Firestore **TTL policies**: `rateLimits` on field `expiresAt` (keeps the collection small).
7. Install the **Trigger Email** extension (`firebase/firestore-send-email`) watching the `mail`
   collection, with your SMTP or SendGrid credentials.

## 2. Secrets and settings for Functions

```bash
firebase use dolgers-staging
firebase functions:secrets:set STRIPE_SECRET_KEY        # sk_test_... / sk_live_...
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # whsec_platform,whsec_connect
firebase functions:secrets:set TYPESENSE_ADMIN_KEY
firebase functions:secrets:set REVALIDATE_SECRET        # long random string, same as App Hosting
```

Non-secret settings are in `functions/.env` (`SITE_URL`, `TYPESENSE_HOST`, `ENFORCE_APP_CHECK`,
`STRIPE_TAX_ENABLED`). Use `functions/.env.dolgers-staging` / `.env.dolgers-prod` to override per
project.

Deploy:

```bash
firebase deploy --only firestore,storage,functions
```

## 3. Stripe

1. Enable **Connect** (Express accounts, United States). Set the platform's branding.
2. Add two webhook endpoints pointing at the `stripeWebhook` function URL:
   - **Account events:** `payment_intent.succeeded`, `payment_intent.canceled`,
     `charge.dispute.created`.
   - **Connected-account events:** `account.updated`.
   Put both signing secrets in `STRIPE_WEBHOOK_SECRET`, comma-separated.
3. Optional: Stripe Tax. Register where required, then set `STRIPE_TAX_ENABLED=true`.

## 4. Typesense

Create a Typesense Cloud cluster in a US region. Put the host in `TYPESENSE_HOST` (Functions and
App Hosting) and the admin key in `TYPESENSE_ADMIN_KEY`. Create a **search-only** key for the
`products` collection and store it as the App Hosting secret `TYPESENSE_SEARCH_KEY`. After the first
deploy, run "Rebuild search index" from the admin console.

## 5. Website on App Hosting

1. `firebase apphosting:backends:create --project dolgers-staging`, connect this GitHub repository,
   root directory **`apps/web`**, live branch `main`, region `us-central1`.
2. Secrets:
   ```bash
   firebase apphosting:secrets:set TYPESENSE_SEARCH_KEY
   firebase apphosting:secrets:set REVALIDATE_SECRET
   ```
   and grant the backend access when prompted.
3. Fill in the `REPLACE_ME` values in `apps/web/apphosting.yaml` (Stripe publishable key, reCAPTCHA
   site key, Typesense host, site URL).
4. **Make the website's identity read-only.** In IAM, find the App Hosting backend's service account
   (`firebase-app-hosting-compute@PROJECT.iam.gserviceaccount.com`), remove broad roles such as
   Editor, and grant `Cloud Datastore Viewer` plus what App Hosting itself needs (Secret Manager
   Secret Accessor for its secrets, Logs Writer). The website then cannot write Firestore even if
   compromised.
5. Add your domain under App Hosting → Domains.

## 6. First admin

Sign up on the site with your own email, then from a trusted machine with project credentials:

```bash
node -e "const a=require('firebase-admin');a.initializeApp({projectId:'dolgers-prod'});a.auth().getUserByEmail('YOU@EXAMPLE.COM').then(u=>a.auth().setCustomUserClaims(u.uid,{admin:true})).then(()=>console.log('done'))"
```

Further admins can be added from the admin console.

## 7. Before taking real money

- Run a full order on staging with test cards: pay, ship (vendor transfer), refund (transfer
  reversal), dispute.
- Confirm the sales-tax plan with an accountant (marketplace facilitator rules).
- Publish terms, privacy, shipping and returns pages reviewed by a lawyer.
- Switch keys to live, re-register webhooks in live mode.

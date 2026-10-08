# DOLGERS

The admin dashboard for DOLGERS, a men’s clothing store stocked only with items that ship from US
warehouses and pass a strict, evidence-based vetting pipeline. Quality over quantity: a product goes
live only when the data says US customers will get what the page promises.

Everything is done from the dashboard. You sign in, add your AliExpress and Claude keys in
Settings, import men’s clothing from the US-warehouse feeds, vet it, review what needs you, and
look inside the database. There is nothing to run from a terminal or Cloud Shell.

| Part | What it is |
| --- | --- |
| `apps/web` | The dashboard: Next.js 16 + Tailwind 4 on Firebase App Hosting (root directory `apps/web`, its own lockfile). |
| `apps/web/src/core` | The pipeline: AliExpress client, review fetcher, vetting engine, Claude analyzers, listing writer, Firestore layer, and the job runner the dashboard drives. |
| `firebase` | Firestore security rules and their tests. |

How it decides is in [ARCHITECTURE.md](ARCHITECTURE.md). Putting it live is in [DEPLOY.md](DEPLOY.md).

## Using the dashboard

| Page | What you do there |
| --- | --- |
| **Overview** | Setup checklist, counts, what needs your review, recent jobs. |
| **Import & vet** | **Import** adds men’s items from the US feeds to the queue. **Vet** runs the next items through the pipeline. **Monitor** re-checks listed products for stock, cost, seller, supplier-listing and new-review changes; it also runs by itself once a day. Live progress and a log; Stop and Resume. |
| **Products** | Nothing goes live by itself. Under Needs review, each product shows the buyer count, problem-rate bound, flags, top complaints and gallery photos beside buyer photos with reverse-image-search buttons. Tick three checks to publish, or delete with a reason (Products → Deleted keeps them for a monthly look). Also: pause, reprice, re-vet, retire, edit the copy, record your own orders and complaints. |
| **Queue** | Every imported item and where it stopped (screened out, not enough data, rejected…). Vet one now, requeue or skip. |
| **Sellers** | AliExpress stores with ratings, strikes and blocks. Block or unblock. |
| **Database** | Read-only browser for every Firestore collection. Keys and tokens are masked. |
| **Settings** | AliExpress (app key, secret, Connect AliExpress, test), Claude (API key, models, test), DOLGERS rules (every vetting threshold, pricing, blocked brand words, feeds), Admins. |

Jobs run in short steps driven by the open browser tab, so keep the Import & vet tab open while a
job runs. Closing it pauses the job; Resume picks up exactly where it stopped.

## Run it locally (for development)

Requires Node 22+ and Java 21 (for the Firebase emulators).

```bash
npm install && npm --prefix apps/web install
npm run emulators            # Firestore :8080 and Auth :9099
```

In a second terminal:

```bash
cd apps/web
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-dolgers \
NEXT_PUBLIC_FIREBASE_API_KEY=demo NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-dolgers \
NEXT_PUBLIC_AUTH_EMULATOR=http://127.0.0.1:9099 npm run dev
```

Create an account in the Auth emulator and sign in at http://localhost:3000. The first account to
sign in becomes the admin.

## Checks

```bash
npm run typecheck && npm test   # the pipeline and job runner (apps/web/test)
npm run build
npm run test:rules              # Firestore rules, against the emulator
```

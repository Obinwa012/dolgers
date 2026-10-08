# DOLGERS

A US clothing store stocked only with products that ship from US warehouses and pass a strict,
evidence-based vetting pipeline. Quality over quantity: a product goes live only when the data says
US customers will get what the page promises.

This repository currently holds **phase 1: the sourcing pipeline and the database**. The storefront
(Next.js + Tailwind + Firebase Auth) and automatic AliExpress order placement are the next phases;
the data model already carries what they need.

| Part | What it is |
| --- | --- |
| `packages/core` | The pipeline: AliExpress client, review fetcher, vetting engine, Claude analyzers, listing writer, Firestore layer. |
| `apps/pipeline` | The command-line runner (also the Cloud Run job image). |
| `firebase` | Firestore security rules, indexes and rules tests. |

How it decides, step by step, is in [ARCHITECTURE.md](ARCHITECTURE.md). Putting it live is in
[DEPLOY.md](DEPLOY.md).

## Run it locally

Requires Node 22+ and Java 21 (for the Firestore emulator).

```bash
npm install
cp apps/pipeline/.env.example apps/pipeline/.env   # add your AliExpress app and Claude API keys
npm run emulators                                   # terminal 1: local Firestore on :8080
```

In terminal 2:

```bash
npm run pipeline -- auth url --redirect https://YOUR-REGISTERED-CALLBACK --emulator
npm run pipeline -- auth exchange THE_CODE --emulator     # stores access + refresh tokens
npm run pipeline -- import --department men --pages 5 --emulator
npm run pipeline -- run --limit 10 --emulator             # screen → vet → write listing → publish
npm run pipeline -- report --emulator
```

`--dry-run` instead of `--emulator` keeps everything in memory and writes the results to
`apps/pipeline/out/`. Dry runs read AliExpress tokens from `AE_ACCESS_TOKEN`.

## Commands

| Command | What it does |
| --- | --- |
| `auth url --redirect <uri>` / `auth exchange <code>` | Connect the AliExpress app; tokens renew themselves afterwards. |
| `auth set --access <t> [--refresh <t>] [--expires <ms>]` / `auth status` | Store or inspect tokens by hand. |
| `import --department men\|women [--pages 5] [--feeds a,b]` | Pull US-warehouse items from the four US feeds into the candidate queue. |
| `run [--limit 25]` | Process due candidates: new ones by recent sales, then rechecks whose date has come. |
| `vet <productId> [--department ...]` | Run one product through the pipeline. |
| `monitor` | Re-check every listed product's price, stock, shipping, seller and ratings; pause what changed. |
| `report` | Count products by status. |

## Checks

```bash
npm run typecheck
npm test              # 57 unit tests: signing, parsing, engine rules, listing checks, the full pipeline with fakes
npm run test:rules    # security rules against the emulator
```

# Architecture

## The principle

The AI finds and quotes evidence; **code makes every decision.** Thresholds live in one config
document, every issue category has a fixed bucket in code, and **nothing goes live by itself**:
every product that passes waits for a person to tick three checks and publish it.

## Men’s clothing only

Imports ask the AliExpress feeds for category 200000343 (men’s clothing) and drop anything else.
The size references, store categories and listing writer are men’s only.

## How the dashboard runs it

A server request can be cut off by the hosting platform, so the work is split into short steps
that each save their progress to Firestore:

- **Jobs** (`core/jobs.ts`, `jobs/{id}`): an import, vet or monitor run. The Import & vet page calls
  `stepJob` in a loop while the tab is open. A lock stops two tabs advancing one job at once.
- **Work** (`core/stages.ts`, `work/{subId}`): one candidate’s vetting, as stages: fetch → reviews →
  images → analysis → photos → decide → seller chart → size guide → shipping → listing → save. A request runs
  stages until it reaches one that calls Claude (at most one Claude call per request) or 25 seconds
  pass, then saves. Reviews are stored in `work/{subId}/parts`.
- **Retries:** a stage is retried up to 3 times, counting requests that were cut off before they
  reported back; then the item is marked *error* and rechecked the next day. A credential problem
  (expired AliExpress token, missing Claude key) stops the whole job instead of failing every item.
- **Settings** come from Firestore: `config/secrets` (AliExpress and Claude keys and tokens) and
  `config/pipeline` (thresholds, models, feeds). The AliExpress token renews itself with the stored
  refresh token.

## The pipeline

All numbers below are defaults, editable in Settings → DOLGERS rules.

### Phase 1: free checks (AliExpress API, no AI)

1. **Store memory.** A blocked store is rejected. A store checked in the last 14 days with any rating
   under 4.5 is screened out without calling AliExpress.
2. **Screen the listing** (one `product.get`, one shipping quote):
   - **Screened out:** off sale; no in-stock US variant; any store rating under 4.5 (or none); no US
     shipping quote; a blocked word in the title. Blocked words are brands, characters and
     celebrities, plus “dupe”, “inspired” and “replica”. Near-miss spellings of brands also count
     (“Addidas”, “Carhart”, “Calvin Klien”).
   - **Not enough data:** fewer than 20 reviews.
   - **Flagged:** delivery promise over 7 days; a “Priority” carrier at $3.99 or less on an item at
     $8 or less.
3. **Reviews** (up to 500, the listing's own). Not enough data unless:
   - they aren't pooled across sellers;
   - every page was fetched;
   - at least 90% say “Ships From: United States”;
   - at most 10% shipped by a China carrier;
   - at least 5 were written in the last 90 days.
4. **Buyers.** One buyer's multi-item order counts once. Under 20 buyers, or 20–59 without a strong
   seller (all ratings 4.7+), stops here, before any AI is paid for.

### Phase 2: AI evidence (Claude finds and quotes; code decides)

5. **Photos for IP:** gallery and variant photos. Logos, celebrities and characters reject. A design
   that copies a known brand's product is named with a reason, as a flag.
6. **Reviews:** every complaint in a fixed category with a verbatim quote, fit comments and the
   material buyers describe. Recent reviews (last 90 days) come first and lead the summary.
7. **Buyer photos vs gallery:** up to 8 buyer photos (low-star and recent first) are compared with
   the gallery. A clear mismatch in design, cut or print counts as an unfixable (C) problem for
   that buyer. Claude also describes the fabric and stitching it can see.

### Phase 3: decide (code only, `vetting/engine.ts`, `vetting/stats.ts`)

- **A** (fixable on the listing: runs small, decorative zippers): becomes a required listing fix.
- **B** (customer service absorbs it: a hole, wrong item, an unexplained 1–3★): the one-sided 95%
  Wilson upper bound on the share of buyers with a problem must be 5% or less. With no problems
  that takes 52 buyers; with one, 87. If even the observed rate is over 5%, it's rejected;
  otherwise more buyers are needed and it's rechecked.
- **C** (can't be fixed: peeling after washing, wrong material, inconsistent sizing, not as
  pictured): rejects at 2+ buyers and more than 1% of buyers; one report flags it. Fake tracking,
  IP and safety reject on one verified report. Seller-level C problems block the store and pause
  its products.
- **Quotes** the code can't find in the cited review flag the product (they can't reject on their own).
- **Recency:** a problem rate in the last 90 days over twice the overall rate is flagged.
- **Fake reviews** are flagged: half of all reviews on 3 days, 3+ near-identical reviews, or 80%+
  of all ratings 5★ with no text.
- **Tier:** *Import* = 60+ buyers, 15+ written reviews, within the bound. *Probation* = 20–59
  buyers, all store ratings 4.7+, within its own bound (also 5% by default, which in practice means
  52+ problem-free buyers). Anything else: not enough data, rechecked in 30 days.

### Phase 4: build the listing

- **Size guide:** the supplier's chart, converted to inches and labelled “Supplier measurements”,
  saying whether it measures the garment or the body. US buyers' fit comments add notes only where
  two or more agree. No generic US sizing is blended in.
- **Shipping per size;** a missing quote holds the product.
- **Copy:** title, bullets, FAQ, SEO from a numbered evidence list. Rejected text: “Made in USA”,
  unsupported claims, brand words, supplier colour codes, unapplied listing fixes, an unconfirmed
  material, and no “Imported”.
- **Price** per variant: (cost + return reserve + $8 profit + $0.30) ÷ 0.971, rounded up to $X.99,
  where cost = item + US shipping and the reserve = 20% × (cost + $6). $13 → $25.99.

### Phase 5: your review (Products → Needs review)

Each product page shows buyers, the upper bound and recent reviews, the top quoted complaints,
gallery photos beside buyer photos (each with Google Lens and TinEye buttons), and every flag with
its reason. Publish unlocks only after three ticks: reverse image search done, no brand
resemblance, listing and size chart read. Or delete with a reason; Products → Deleted groups the
last 30 days' reasons for a monthly look.

### Phase 6: after publishing

- **Monitor** runs daily (`.github/workflows/monitor.yml` calls `/api/cron/monitor`, which starts at
  most one run per 20 hours) and from the Monitor button. It hides out-of-stock sizes, pauses when
  none are left, when the listing goes off sale, a store rating drops under 4.5 or the seller is
  blocked, and when a cost rise drops profit below $7. It flags supplier changes to the title,
  photos or material, and unfixable problems in reviews it hasn't seen before.
- **Your orders:** until orders flow in automatically, record orders, refunds, complaints and
  disputes on the product page. One unfixable complaint pauses the product; a refund rate over
  10% (after 10 orders) pauses it; a payment dispute raises an urgent flag. Probation pauses a
  product with too many defects in its first 40 orders.

## Data model (Firestore)

The dashboard reads and writes only from its server, with the Admin SDK. Browsers have no direct
access to the database except reading live products (for a future storefront or product feed).

| Collection | Contents |
| --- | --- |
| `products/{ae-<mainId>}` | Title, bullets, FAQ, SEO, images and alts, variants with US names and prices, size guide, delivery window, material, origin, probation counters, hold reasons. Public when `live`. |
| `sourcing/{id}` | AliExpress ids, store, per-variant cost/shipping/landed/priced cost, stock, last monitor check. |
| `vetting/{id}` | The full decision record: every check, metrics, issues with quotes, image findings, seller chart, evidence list and the claims made from it. |
| `sellers/{storeId}` | Ratings, strikes, block reasons, shipping fingerprint. |
| `candidates/{subId}` | The queue: status, reasons and when to recheck. |
| `jobs/{id}` | Import, vet and monitor runs with progress, counts and a log. |
| `work/{subId}` | Vetting in progress, saved after every stage. |
| `config/pipeline` | Thresholds, AI models, feeds, pages per import (Settings → DOLGERS rules). |
| `config/secrets` | AliExpress app key/secret/tokens and the Claude API key. Never sent to a browser. |
| `users/{uid}` | `admin: true` marks a dashboard admin. |
| `deletions/{id}` | Products deleted at review, with the reason. |
| `sessions/{token}`, `oauth_states/{state}` | Sign-in sessions and the one-time AliExpress connect state. |

Money is integer cents. Timestamps are epoch milliseconds. Queries avoid composite indexes, so
nothing has to be deployed for them to work.

## Known limits

- **The review endpoint is undocumented.** It's what the AliExpress product page uses, not part of the official API. If it changes or blocks the job, products fall to *insufficient data*. They are never approved without reviews.
- **Small samples:** 30 clean buyers still allows a true defect rate up to about 10%. That's why every new product starts on probation, with delisting after 2 defects in the first 40 orders (1 in 20 for probation-tier products). Order intake will drive those counters once order handling exists.
- **Keyword volumes aren't measured.** SEO keywords are stored as `keywordStatus: 'guess'` until checked in Keyword Planner or Search Console.
- **AI output can be wrong:**
  - Quotes are verified, review ids that don't exist are dropped, and categories are mapped by code.
  - Listing text is checked by `validateListing`.
  - Anything uncertain lands in `pending_review`, not live.

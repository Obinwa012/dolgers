# Architecture

## The principle

The AI finds and quotes evidence; **code makes every decision.** Thresholds live in one config
document, every issue category has a fixed bucket in code, and a product only goes live
automatically when no rule asks for a person to look.

## The pipeline

```
feeds ──▶ candidates ──▶ 1 screen ──▶ 2 seller ──▶ 3 reviews + trust ──▶ 4 AI evidence ──▶ 5 decide ──▶ 6 listing ──▶ products
 import      queue        (API)       history       (no AI spend yet)     images, reviews     rules       size chart,      live or
                                                                                                         copy, SEO,       pending_review
                                                                                                         prices
                                                                    monitor (daily) ◀────────────────────────────────────────┘
```

1. **Screen** (`vetting/engine.ts › screen`, one `product.get` + one freight quote)
   - The listing is on sale.
   - Only variants that ship from the United States and have stock are kept.
   - All three store ratings are ≥ 4.5.
   - No brand or celebrity terms in the title.
   - A US shipping quote exists, with delivery within 15 days.
   - At least 10 reviews.
   - **Flagged for review:** a "Priority" carrier charging ≤ $3.99 on an item ≤ $8. That's below the carrier's normal cost and a known sign of label fraud.
2. **Seller history.** A blocked seller's listings are rejected before any review is fetched. A store whose shipping fingerprint matches a blocked store with a nearby store ID is flagged as a possible sibling.
3. **Reviews and trust** (`reviews/reviews.ts`, `trustCheck`). All review pages are fetched from AliExpress's public review endpoint. They must be:
   - **The listing's own:** product type `ORDINARY`, with no "reviews from various sellers" notice.
   - **Complete.**
   - **≥ 90% for US-warehouse variants.**
   - **≤ 10% shipped by China carriers.**

   Buyers are counted after grouping one buyer's multi-item order as one. Too few buyers stops here, **before any AI is paid for**.
4. **AI evidence** (`ai/`). Claude, with structured outputs:
   - checks gallery and variant photos for likenesses, logos and licensed characters;
   - lists every complaint under a fixed category, with the review ids and a verbatim quote;
   - extracts fit comments, including the buyer's height and weight.
5. **Decide** (`vetting/engine.ts › vet`, `vetting/issues.ts`).
   - **A, fixable on the listing** (runs large, decorative zippers, thin fabric): turned into required listing fixes. Doesn't count toward the problem rate.
   - **B, absorbable** (holes, misprints, wrong item, one lost parcel, unexplained 1–3★): counts toward the **1-in-40 cap**. An A tag never excuses a 1–3★ review.
   - **C, systemic** (peeling after washing, material mismatch, inconsistent sizing on the same measurement, quality dropping on repeat orders, ≥2 non-deliveries, fake tracking, IP):
     - rejects at 2 buyers, or at 1 for fake tracking, IP and safety;
     - at 1 buyer, needs review.
   - **Quote check:** an issue whose quote isn't found in the cited review can't reject on a single report or strike the seller.
   - **Seller-level C issues** block the seller and pause its live products.
   - **Tiers:**

     | Tier | Requirement |
     | --- | --- |
     | Import | ≥ 30 buyers and ≥ 10 with text |
     | Probation | ≥ 10 buyers and a strong seller (all ratings ≥ 4.7) |
     | Insufficient data | Anything else; rechecked in 30 days |
6. **Listing** (`ai/size-chart.ts`, `listing/listing.ts`)
   - **Size chart:** the seller's chart is read from the description images and converted to inches. A US guide is then built from that chart, US buyers' fit reviews and US reference sizing.
   - **Copy:** Claude writes the title, bullets, FAQ, SEO fields, variant colour names and alt text from a numbered **evidence list**. `validateListing` then rejects:
     - "Made in USA" in any form;
     - puffery;
     - performance claims not in the evidence;
     - materials other than the confirmed one;
     - brand words;
     - supplier colour codes;
     - listing fixes that weren't applied;
     - an unknown material.

     Each problem holds the product.
   - **Pricing:** per variant, retail = max(landed × 1.8, landed + $7), rounded up to x.99, where landed = supplier price + US shipping for that size.
   - **Publishing:** only a plain *import* with zero hold reasons is published as `live`. Everything else lands as `pending_review` with the reasons listed.
7. **Monitor.** For every listed product, daily:
   - **Pause** when:
     - the supplier listing is off sale;
     - any store rating drops below 4.5;
     - the seller is blocked;
     - no variant is in stock with US shipping;
     - the landed cost rises more than 15% above the cost the price was set from.
   - **Stock:** out-of-stock variants are marked unavailable.

## Data model (Firestore)

| Collection | Who reads it | Contents |
| --- | --- | --- |
| `products/{ae-<mainId>}` | Public when `live`; admins always | Title, bullets, FAQ, SEO, images and alts, variants with US names and prices, size guide, delivery window, material, origin, probation counters, hold reasons. |
| `sourcing/{id}` | Admins | AliExpress ids, store, per-variant cost/shipping/landed/priced cost, stock, last monitor check. Kept private so the supplier isn't exposed on the storefront. |
| `vetting/{id}` | Admins | The full decision record: every check, metrics, issues with quotes, image findings, seller chart, evidence list and the claims made from it. Kept for rejects too. |
| `sellers/{storeId}` | Admins | Ratings, strikes, block reasons, shipping fingerprint. |
| `candidates/{subId}` | Admins | The queue: status, reasons and when to recheck. |
| `runs/{id}` | Admins | Each pipeline run's counts and errors. |
| `config/pipeline` | Admins | Threshold overrides (see `vetting/config.ts`). |
| `config/aliexpress` | Nobody client-side | API tokens. |

Money is integer cents. Timestamps are epoch milliseconds. Only the pipeline writes, using the Admin
SDK; the rules deny every client write.

## Known limits

- **The review endpoint is undocumented.** It's what the AliExpress product page uses, not part of the official API. If it changes or blocks the job, products fall to *insufficient data*. They are never approved without reviews.
- **Small samples:** 30 clean buyers still allows a true defect rate up to about 10%. That's why every new product starts on probation, with delisting after 2 defects in the first 40 orders (1 in 20 for probation-tier products). Order intake will drive those counters once checkout exists.
- **Keyword volumes aren't measured.** SEO keywords are stored as `keywordStatus: 'guess'` until checked in Keyword Planner or Search Console.
- **AI output can be wrong:**
  - Quotes are verified, review ids that don't exist are dropped, and categories are mapped by code.
  - Listing text is checked by `validateListing`.
  - Anything uncertain lands in `pending_review`, not live.

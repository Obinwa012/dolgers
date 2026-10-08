import type { Review, ReviewSet } from '../types.ts';
import { asArray, num, obj, parseReviewDate, sleep as realSleep, str } from '../util.ts';

/**
 * AliExpress reviews come from the same endpoint the product page uses. It is public and
 * undocumented, so it can change or rate-limit without notice: fetch slowly, and treat an
 * incomplete set as "insufficient data", never as "no problems".
 */
const ENDPOINT = 'https://feedback.aliexpress.com/pc/searchEvaluation.do';

export function parseReviewItem(raw: unknown): Review {
  const r = obj(raw);
  const labels: Record<string, string> = {};
  for (const i of [1, 2, 3]) {
    const k = str(r[`reviewLabel${i}`]).trim();
    const v = str(r[`reviewLabelValue${i}`]).trim();
    if (k && v) labels[k] = v;
  }
  const skuInfo = str(r.skuInfo).trim();
  const translated = str(r.buyerTranslationFeedback).trim();
  return {
    id: str(r.evaluationIdStr || r.evaluationId),
    buyer: str(r.buyerName),
    anonymous: r.anonymous === true,
    country: str(r.buyerCountry).toUpperCase(),
    stars: Math.max(1, Math.min(5, Math.round((num(r.buyerEval) ?? 100) / 20))),
    date: parseReviewDate(str(r.evalDate)),
    skuInfo,
    shipsFromUS: /Ships From:\s*United States/i.test(skuInfo),
    logistics: str(r.logistics).trim(),
    text: translated || str(r.buyerFeedback).trim(),
    additionalText: str(r.buyerAddFbTranslation || r.buyerAddFbContent).trim(),
    images: asArray(r.images as unknown[]).length,
    labels,
    selected: r.selectedReview === true,
  };
}

export function parseReviewPage(json: unknown): {
  set: Omit<ReviewSet, 'mainId' | 'reviews' | 'complete' | 'sampled' | 'fetchedAt'>;
  reviews: Review[];
  totalPages: number;
  /** Written reviews the listing says it has. */
  writtenTotal: number;
} {
  const data = obj(obj(json).data);
  const st = obj(data.productEvaluationStatistic);
  const filterCounts: Record<string, number> = {};
  for (const f of asArray(obj(data.filterInfo).filterStatistic as unknown[])) {
    const ff = obj(f);
    filterCounts[str(ff.filterCode)] = num(ff.filterCount) ?? 0;
  }
  const total = num(data.totalNum) ?? num(st.totalNum) ?? 0;
  return {
    set: {
      productType: str(data.productType) || 'UNKNOWN',
      pooledNotice: data.explanatoryCopy ? str(data.explanatoryCopy) : null,
      stats: {
        total: num(st.fiveStarNum) !== null
          ? (num(st.oneStarNum) ?? 0) + (num(st.twoStarNum) ?? 0) + (num(st.threeStarNum) ?? 0) +
            (num(st.fourStarNum) ?? 0) + (num(st.fiveStarNum) ?? 0)
          : total,
        avg: num(st.evarageStar),
        byStars: {
          1: num(st.oneStarNum) ?? 0,
          2: num(st.twoStarNum) ?? 0,
          3: num(st.threeStarNum) ?? 0,
          4: num(st.fourStarNum) ?? 0,
          5: num(st.fiveStarNum) ?? 0,
        },
      },
      filterCounts,
    },
    reviews: asArray(data.evaViewList as unknown[]).map(parseReviewItem),
    totalPages: num(data.totalPage) ?? Math.max(1, Math.ceil(total / Math.max(1, num(data.pageSize) ?? 20))),
    writtenTotal: total,
  };
}

export interface ReviewFetcherOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pageDelayMs?: number;
  maxPages?: number;
}

export type ReviewPage = ReturnType<typeof parseReviewPage>;

/** One page (20 reviews) from the review endpoint, with retries. */
export async function fetchReviewPage(mainId: string, page: number, o: ReviewFetcherOptions = {}): Promise<ReviewPage> {
  const fetchImpl = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? realSleep;
  const u = new URL(ENDPOINT);
  u.search = new URLSearchParams({
    productId: mainId,
    lang: 'en_US',
    country: 'US',
    page: String(page),
    pageSize: '20',
    filter: 'all',
    sort: 'complex_default',
  }).toString();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchImpl(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DolgersVetting/1.0)',
          Referer: `https://www.aliexpress.com/item/${mainId}.html`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseReviewPage(await res.json());
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Assembles fetched pages into a review set. `failed` = a page that should exist couldn't be fetched. */
export function assembleReviews(
  mainId: string,
  first: ReviewPage,
  reviews: Review[],
  o: { failed: boolean; maxPages: number },
): ReviewSet {
  const unique = dedupeById(reviews);
  const sampled = first.totalPages > o.maxPages;
  // Complete = we hold (nearly) every written review, or a full sample of a very large listing.
  const complete = !o.failed && (sampled || unique.length >= Math.floor(first.writtenTotal * 0.95));
  return { mainId, ...first.set, reviews: unique, complete, sampled, fetchedAt: Date.now() };
}

export async function fetchReviews(mainId: string, o: ReviewFetcherOptions = {}): Promise<ReviewSet> {
  const sleep = o.sleep ?? realSleep;
  const maxPages = o.maxPages ?? 50;
  const first = await fetchReviewPage(mainId, 1, o);
  const reviews = [...first.reviews];
  let failed = false;
  const pages = Math.min(first.totalPages, maxPages);
  for (let page = 2; page <= pages; page++) {
    await sleep(o.pageDelayMs ?? 1500);
    try {
      reviews.push(...(await fetchReviewPage(mainId, page, o)).reviews);
    } catch {
      failed = true;
      break;
    }
  }
  return assembleReviews(mainId, first, reviews, { failed, maxPages });
}

function dedupeById(reviews: Review[]): Review[] {
  const seen = new Set<string>();
  return reviews.filter((r) => (r.id && seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Masked names that many different people share, so they can't identify a buyer. */
const GENERIC_NAMES = new Set(['AliExpress Shopper', 'U***r', '']);

/**
 * Groups reviews into buyers. AliExpress posts one review per item in an order, so a buyer who
 * bought three colours appears three times. Same masked name + date + country = same buyer;
 * generic names only merge when the text is identical too.
 */
export function groupBuyers(reviews: Review[]): Review[][] {
  const groups = new Map<string, Review[]>();
  for (const r of reviews) {
    const generic = r.anonymous || GENERIC_NAMES.has(r.buyer);
    const key = !generic
      ? `n|${r.buyer}|${r.date}|${r.country}`
      : r.text
        ? `t|${r.date}|${r.country}|${r.text}`
        : `id|${r.id}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.values()];
}

export function isPooled(set: Pick<ReviewSet, 'productType' | 'pooledNotice'>): boolean {
  return set.productType.toUpperCase() !== 'ORDINARY' || !!set.pooledNotice;
}

/** Shipping methods that mean "shipped from China", whatever the variant says. */
const CHINA_LOGISTICS = /AliExpress Standard|Selection Standard|Selection Saver|Cainiao (Super )?Economy|China Post|YunExpress|4PX|Cainiao Standard For|Choice Standard/i;

export function isChinaLogistics(logistics: string): boolean {
  return CHINA_LOGISTICS.test(logistics);
}

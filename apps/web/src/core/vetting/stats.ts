import { groupBuyers } from '../reviews/reviews.ts';
import type { Review, ReviewSet } from '../types.ts';
import type { VettingConfig } from './config.ts';

/** z for a one-sided 95% bound. */
const Z = 1.6448536269514722;

/**
 * One-sided 95% Wilson upper bound on a rate: with `problems` out of `n`, the true rate is below
 * this with 95% confidence. 0 of 52 → 5.0%; 1 of 87 → 5.0%; 0 of 20 → 11.9%.
 */
export function wilsonUpper(problems: number, n: number): number {
  if (n <= 0) return 1;
  const p = problems / n;
  const z2 = Z * Z;
  const centre = p + z2 / (2 * n);
  const spread = Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return Math.min(1, (centre + spread) / (1 + z2 / n));
}

/** Smallest number of buyers at which `problems` problems still pass `bound`. */
export function buyersNeeded(problems: number, bound: number): number {
  for (let n = Math.max(1, problems); n < 100_000; n++) if (wilsonUpper(problems, n) <= bound) return n;
  return Infinity;
}

const DAY = 24 * 3600 * 1000;

export function isRecent(date: string, now: number, days: number): boolean {
  const t = Date.parse(date);
  return Number.isFinite(t) && now - t <= days * DAY;
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

export interface FakeReviewSignals {
  flags: string[];
  /** Share of written reviews posted on the three busiest days. */
  burstShare: number;
  burstDays: string[];
  /** Reviews whose text is (nearly) the same as another review's. */
  duplicateReviewIds: string[];
  /** Share of all ratings that are 5 stars without text. */
  noText5StarShare: number | null;
}

/** Signs that reviews were bought or seeded. Each is a flag for a person, never an automatic reject. */
export function fakeReviewSignals(set: ReviewSet, config: VettingConfig): FakeReviewSignals {
  const flags: string[] = [];
  const written = set.reviews;
  const t = config.fakeReviews;

  // Counted per buyer: one buyer reviewing three colours with the same words is one voice.
  const buyerOf = new Map<string, number>();
  groupBuyers(written).forEach((g, i) => g.forEach((r) => buyerOf.set(r.id, i)));

  // Bursts: many buyers reviewing on a handful of days.
  const byDay = new Map<string, Set<number>>();
  for (const r of written) if (r.date) byDay.set(r.date, (byDay.get(r.date) ?? new Set()).add(buyerOf.get(r.id) ?? -1));
  const buyersTotal = new Set(buyerOf.values()).size;
  const top = [...byDay].map(([d, b]) => [d, b.size] as const).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const burstShare = buyersTotal ? top.reduce((s, [, n]) => s + n, 0) / buyersTotal : 0;
  // Only meaningful when reviews are spread over more than three days at all.
  if (buyersTotal >= 10 && byDay.size > 3 && burstShare >= t.burstShare) {
    flags.push(`${Math.round(burstShare * 100)}% of buyers reviewed on 3 days (${top.map(([d, n]) => `${d}: ${n}`).join(', ')})`);
  }

  // Near-identical text from different buyers (ignoring very short reviews like "good").
  const texts = written
    .map((r) => ({ id: r.id, buyer: buyerOf.get(r.id), w: new Set(words(`${r.text} ${r.additionalText}`)) }))
    .filter((x) => x.w.size >= 5);
  const dup = new Set<string>();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (texts[i]!.buyer !== texts[j]!.buyer && jaccard(texts[i]!.w, texts[j]!.w) >= 0.8) {
        dup.add(texts[i]!.id);
        dup.add(texts[j]!.id);
      }
    }
  }
  if (dup.size >= t.duplicateReviews) flags.push(`${dup.size} reviews are near-identical to another review`);

  // 5-star ratings with no text. Written 5-star count is scaled up when only a sample was fetched.
  let noText5StarShare: number | null = null;
  const total = set.stats.total;
  const writtenTotal = set.writtenTotal ?? written.length;
  if (total >= 20 && written.length) {
    // 5-star reviews that do have text, scaled up when only a sample was fetched.
    const written5 = (written.filter((r) => r.stars === 5 && (r.text || r.additionalText)).length / written.length) * writtenTotal;
    noText5StarShare = Math.max(0, set.stats.byStars[5] - written5) / total;
    if (noText5StarShare >= t.noText5StarShare) {
      flags.push(`${Math.round(noText5StarShare * 100)}% of all ratings are 5 stars with no text`);
    }
  }
  return { flags, burstShare, burstDays: top.map(([d]) => d), duplicateReviewIds: [...dup], noText5StarShare };
}

export function recentReviews(reviews: Review[], now: number, days: number): Review[] {
  return reviews.filter((r) => isRecent(r.date, now, days));
}

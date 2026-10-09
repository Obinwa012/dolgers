/** Small display helpers shared by server and client components (no server imports here). */

export const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `$${(cents / 100).toFixed(2)}`;

export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(digits)}%`;

/** Times show in US Central, where DOLGERS is run, the same on the server and in the browser. */
export const TIME_ZONE = 'America/Chicago';

export function when(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: TIME_ZONE });
}

export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return 'never';
  const s = Math.round((now - ms) / 1000);
  if (s < 0) return `in ${until(ms, now)}`;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function until(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((ms - now) / 1000));
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export const OUTCOME_LABEL: Record<string, string> = {
  ready: 'Passed: ready for your review',
  skipped: 'Skipped after errors',
  published: 'Published',
  held: 'Held for review',
  insufficient_data: 'Not enough data',
  rejected: 'Rejected',
  screened_out: 'Screened out',
  error: 'Error',
  seen: 'Items seen',
  tooFewSales: 'Too few sales',
  added: 'New in queue',
  updated: 'Already queued',
  changed: 'Changed',
  unchanged: 'Unchanged',
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  pending_review: 'Needs review',
  paused: 'Paused',
  retired: 'Retired',
};

export const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  new: 'Waiting',
  vetting: 'Vetting now',
  screened_out: 'Screened out',
  insufficient_data: 'Not enough data',
  rejected: 'Rejected',
  held: 'Waiting for your review',
  published: 'Published',
  error: 'Error',
};

export const DECISION_LABEL: Record<string, string> = {
  import: 'Import',
  probation: 'Probation',
  needs_review: 'Needs review',
  insufficient_data: 'Not enough data',
  reject: 'Reject',
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL'];
/** Sorts clothing sizes the way shoppers expect (S, M, L, XL…), numeric sizes by number. */
export function sizeRank(size: string): number {
  const s = size.trim().toUpperCase();
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = parseFloat(s);
  return Number.isFinite(n) ? 100 + n : 1000;
}
export const bySize = <T extends { size: string }>(a: T, b: T) => sizeRank(a.size) - sizeRank(b.size);
export const sortSizes = (sizes: string[]) => [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b));

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';

export function toneFor(status: string): Tone {
  if (['live', 'published', 'import', 'done', 'pass', 'ready'].includes(status)) return 'good';
  if (['pending_review', 'held', 'needs_review', 'probation', 'paused', 'insufficient_data', 'stopped'].includes(status)) return 'warn';
  if (['rejected', 'reject', 'error', 'retired', 'blocked'].includes(status)) return 'bad';
  if (['running', 'vetting', 'new'].includes(status)) return 'info';
  return 'neutral';
}

/** Reasons offered when you delete a product at review; grouped monthly to find new rules. */
export const DELETE_REASONS = [
  'Photos belong to another brand or seller',
  'Design resembles a brand',
  'Size chart doesn’t make sense',
  'Price isn’t competitive',
  'Listing text is wrong or misleading',
  'Buyer photos don’t match',
  'Other',
] as const;


export function lensUrl(img: string) {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img)}`;
}
export function tineyeUrl(img: string) {
  return `https://tineye.com/search?url=${encodeURIComponent(img)}`;
}

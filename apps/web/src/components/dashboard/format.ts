import type { Cents } from '@dolgers/shared';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatDate(ms: number | null | undefined): string {
  return ms ? dateFmt.format(new Date(ms)) : '—';
}

export function formatDateTime(ms: number | null | undefined): string {
  return ms ? dateTimeFmt.format(new Date(ms)) : '—';
}

/** Cents to the text a dollar input shows: 42000 -> "420", 1950 -> "19.50". */
export function centsToInput(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Parses "$1,234.5" into 123450 cents. Returns null for empty or invalid input. */
export function parseDollars(input: string): Cents | null {
  const clean = input.replace(/[$,\s]/g, '');
  if (!clean) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/** Basis points as a percent string: 1500 -> "15". */
export function bpsToPercent(bps: number): string {
  return String(Math.round(bps) / 100);
}

/** "15" or "12.5" percent -> basis points. Null when invalid. */
export function percentToBps(input: string): number | null {
  const clean = input.replace(/[%\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function humanize(status: string): string {
  const s = status.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Local date (yyyy-mm-dd) for a date input, from epoch millis. */
export function toDateInput(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Start of a local day from a yyyy-mm-dd input (or the end of that day when `end` is set). */
export function fromDateInput(value: string, end = false): number | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return end ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}

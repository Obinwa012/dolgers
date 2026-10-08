export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** "12.98" (US dollars) → 1298 cents. */
export function dollarsToCents(v: unknown): number | null {
  const n = num(typeof v === 'string' ? v.replace(/[^0-9.\-]/g, '') : v);
  return n === null ? null : Math.round(n * 100);
}

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "08 Nov 2025" → "2025-11-08". Returns the input unchanged if it doesn't match. */
export function parseReviewDate(s: string): string {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/.exec(s.trim());
  if (!m) return s.trim();
  const mon = MONTHS[m[2]!.toLowerCase()];
  return mon ? `${m[3]}-${mon}-${m[1]!.padStart(2, '0')}` : s.trim();
}

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

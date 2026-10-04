import type { Cents } from './types.ts';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** $420 for whole dollars, $19.50 otherwise. */
export function formatMoney(cents: Cents): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return usd.format(dollars).replace(/\.00$/, '');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function isCents(n: unknown): n is Cents {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

/**
 * Splits `total` across `weights` in proportion, in whole cents, so the parts always sum to
 * `total` exactly (largest-remainder method). Used to share a discount across vendors.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sum === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

/** Basis points of an amount, rounded half up to the cent. */
export function bps(amount: Cents, basisPoints: number): Cents {
  return Math.round((amount * basisPoints) / 10_000);
}

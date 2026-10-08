import type { VettingConfig } from './config.ts';

/** Retail price for one variant: landed cost × markup, at least cost + min profit, rounded up to x.99. */
export function retailPriceCents(landedCostCents: number, pricing: VettingConfig['pricing']): number {
  const target = Math.max(Math.ceil(landedCostCents * pricing.markup), landedCostCents + pricing.minProfitCents);
  const dollars = Math.ceil((target + 1) / 100); // next whole dollar strictly above target-0.99
  return dollars * 100 - 1;
}

export function relativeChange(oldCents: number, newCents: number): number {
  if (!oldCents) return newCents ? 1 : 0;
  return Math.abs(newCents - oldCents) / oldCents;
}

import type { VettingConfig } from './config.ts';

type Pricing = VettingConfig['pricing'];

/** Money set aside per sale for returns: rate × (cost + return shipping). */
export function returnReserveCents(landedCostCents: number, p: Pricing): number {
  return Math.round(p.returnReserveRate * (landedCostCents + p.returnShippingCents));
}

/**
 * Retail price from break-even: (cost + return reserve + profit + fixed fee) ÷ (1 − fee rate),
 * rounded up to $X.99. Example with the defaults: $13.00 landed → $25.99.
 */
export function retailPriceCents(landedCostCents: number, p: Pricing): number {
  const needed = (landedCostCents + returnReserveCents(landedCostCents, p) + p.profitCents + p.paymentFeeFixedCents) / (1 - p.paymentFeeRate);
  return Math.ceil((Math.ceil(needed) + 1) / 100) * 100 - 1;
}

/** What one sale at `priceCents` earns after cost, the return reserve and payment fees. */
export function profitCents(priceCents: number, landedCostCents: number, p: Pricing): number {
  return Math.round(priceCents * (1 - p.paymentFeeRate) - p.paymentFeeFixedCents - landedCostCents - returnReserveCents(landedCostCents, p));
}

export function relativeChange(oldCents: number, newCents: number): number {
  if (!oldCents) return newCents ? 1 : 0;
  return Math.abs(newCents - oldCents) / oldCents;
}

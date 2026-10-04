import type { VendorPrivate } from '@dolgers/shared';

/** Short Stripe Connect status for a vendor. */
export function stripeLabel(p: VendorPrivate | null | undefined): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  if (!p?.stripeAccountId) return { label: 'Not started', tone: 'neutral' };
  if (!p.detailsSubmitted) return { label: 'Unfinished', tone: 'warn' };
  if (!p.payoutsEnabled || !p.chargesEnabled) return { label: 'Verifying', tone: 'warn' };
  return { label: 'Active', tone: 'good' };
}

import Stripe from 'stripe';
import { HttpsError } from 'firebase-functions/https';
import { STRIPE_SECRET_KEY } from './params.ts';

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'Payments are not configured yet.');
  if (!client) client = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: 'DOLGERS' } });
  return client;
}

'use client';

// Typed wrappers around the Cloud Functions. Inputs are checked by the same schemas on the
// server; nothing here is trusted.
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import type { AccountAction, AdminAction, CreateCheckoutInput, OrderTotals, VendorAction } from '@dolgers/shared';
import { firebase } from './client';

function callable<I, O>(name: string) {
  return async (input: I): Promise<O> => {
    const fb = firebase();
    if (!fb) throw new Error('Accounts and checkout are not available in demo mode.');
    const res: HttpsCallableResult<O> = await httpsCallable<I, O>(fb.functions, name)(input);
    return res.data;
  };
}

export interface CheckoutSession {
  orderId: string;
  orderNumber: string;
  clientSecret: string;
  totals: OrderTotals;
  expiresAt: number;
}

export const createCheckout = callable<Partial<CreateCheckoutInput>, CheckoutSession>('createCheckout');

type ActionInput<A extends { action: string; data: unknown }> = { [K in A['action']]: { action: K; data: Extract<A, { action: K }>['data'] } }[A['action']];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const vendorApi = callable<ActionInput<VendorAction>, any>('vendorApi');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminApi = callable<ActionInput<AdminAction>, any>('adminApi');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accountApi = callable<ActionInput<AccountAction>, any>('accountApi');

/** Turns a Functions error into a sentence for the UI. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message.replace(/^(FirebaseError|Error):\s*/, '');
  }
  return 'Something went wrong. Please try again.';
}

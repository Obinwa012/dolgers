import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import type { z } from 'zod';
import type { DolgersClaims } from '@dolgers/shared';
import { db, now } from './firebase.ts';

export interface Caller {
  uid: string;
  email: string | null;
  claims: DolgersClaims;
  anonymous: boolean;
}

export function requireAuth(req: CallableRequest<unknown>): Caller {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const token = req.auth.token;
  return {
    uid: req.auth.uid,
    email: (token.email as string | undefined) ?? null,
    claims: { admin: token.admin === true, vendorId: token.vendorId as string | undefined, vendorRole: token.vendorRole as DolgersClaims['vendorRole'] },
    anonymous: token.firebase?.sign_in_provider === 'anonymous',
  };
}

export function requireAdmin(req: CallableRequest<unknown>): Caller {
  const caller = requireAuth(req);
  if (!caller.claims.admin) throw new HttpsError('permission-denied', 'Admins only.');
  return caller;
}

export function requireVendor(req: CallableRequest<unknown>): Caller & { vendorId: string } {
  const caller = requireAuth(req);
  if (!caller.claims.vendorId) throw new HttpsError('permission-denied', 'This account is not linked to a vendor.');
  return { ...caller, vendorId: caller.claims.vendorId };
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpsError('invalid-argument', `${first.path.join('.') || 'input'}: ${first.message}`);
  }
  return result.data;
}

/**
 * Fixed-window rate limit kept in Firestore, so it holds across every function instance.
 * `key` is usually `${action}:${uid}`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const ref = db.collection('rateLimits').doc(key.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 300));
  const t = now();
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { windowStart: number; count: number } | undefined;
    if (!data || t - data.windowStart > windowSeconds * 1000) {
      tx.set(ref, { windowStart: t, count: 1, expiresAt: new Date(t + windowSeconds * 1000 * 2) });
      return true;
    }
    if (data.count >= max) return false;
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a moment and try again.');
}

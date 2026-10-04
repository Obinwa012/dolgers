import type { Transaction } from 'firebase-admin/firestore';
import type { LedgerEntry } from '@dolgers/shared';
import { db, now } from './firebase.ts';

type Entry = Omit<LedgerEntry, 'id' | 'createdAt' | 'currency'>;

/** Writes one ledger entry. Pass a transaction to make it part of a larger atomic write. */
export function ledger(entry: Entry, tx?: Transaction) {
  const ref = db.collection('ledger').doc();
  const doc: LedgerEntry = { ...entry, id: ref.id, currency: 'usd', createdAt: now() };
  if (tx) tx.set(ref, doc);
  else return ref.set(doc);
}

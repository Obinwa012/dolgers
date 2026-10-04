import type { Transaction } from 'firebase-admin/firestore';
import { db, now } from './firebase.ts';

/**
 * Queues an email in the `mail` collection, the format read by the official
 * "Trigger Email from Firestore" extension. Install that extension with any SMTP provider
 * (SendGrid, Postmark, Mailgun) to deliver these; until then they simply queue up.
 */
export function queueMail(to: string, subject: string, text: string, tx?: Transaction) {
  const ref = db.collection('mail').doc();
  const doc = { to, message: { subject, text }, createdAt: now() };
  if (tx) tx.set(ref, doc);
  else return ref.set(doc);
}

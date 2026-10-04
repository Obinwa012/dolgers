import { db, now } from './firebase.ts';

/** Append-only record of admin and money actions. */
export async function audit(actorUid: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const ref = db.collection('auditLog').doc();
  await ref.set({ id: ref.id, actorUid, action, target, detail, createdAt: now() });
}

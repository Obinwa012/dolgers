import "server-only";
import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as local from "@/data/catalog";
import type { Product } from "@/lib/types";

/**
 * Firebase Admin SDK (server only; bypasses security rules).
 * Credentials come from Application Default Credentials:
 *  - locally: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json in .env.local
 *  - on Firebase App Hosting / Cloud Run: the runtime service account, nothing to configure.
 */
function app() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());

/** Verify the `Authorization: Bearer <Firebase ID token>` header. Returns null if missing/invalid. */
export async function verifyRequestUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch {
    return null;
  }
}

/**
 * Load products by id from the source of truth. Mirrors src/lib/catalog.ts: Firestore once the
 * catalog is seeded, otherwise the bundled demo catalog (which ships with the server, so it's trusted).
 * Returns `fromFirestore` so the webhook knows whether there is stock to decrement.
 */
export async function loadProducts(ids: string[]): Promise<{ products: Map<string, Product>; fromFirestore: boolean }> {
  const db = adminDb();
  const col = db.collection("products");
  const seeded = !(await col.limit(1).get()).empty;
  const products = new Map<string, Product>();
  if (!seeded) {
    for (const p of local.products) if (ids.includes(p.id)) products.set(p.id, p);
    return { products, fromFirestore: false };
  }
  const snaps = await db.getAll(...ids.map((id) => col.doc(id)));
  for (const s of snaps) if (s.exists) products.set(s.id, { ...(s.data() as Product), id: s.id });
  return { products, fromFirestore: true };
}

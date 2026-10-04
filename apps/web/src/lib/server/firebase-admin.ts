import 'server-only';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let db: Firestore | null | undefined;

/**
 * Server-side Firestore. In production the App Hosting service account is granted read-only
 * database access (roles/datastore.viewer), so this code cannot change orders, stock or roles
 * even if the website were compromised: all writes go through Cloud Functions.
 * Returns null in demo mode, when no project is configured.
 */
export function serverDb(): Firestore | null {
  if (db !== undefined) return db;
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (process.env.FIREBASE_CONFIG ? (JSON.parse(process.env.FIREBASE_CONFIG).projectId as string) : undefined) ??
    (process.env.FIRESTORE_EMULATOR_HOST ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : undefined);
  if (!projectId) {
    // Visible in Cloud Logging: if this ever fires in production, the storefront silently
    // falls back to demo data instead of reading Firestore.
    console.warn('[firebase-admin] no project id configured; running in demo mode (no Firestore)');
    db = null;
    return db;
  }
  const app = getApps()[0] ?? initializeApp({ projectId });
  db = getFirestore(app);
  return db;
}

'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseEnabled, publicEnv } from '@/lib/env';

interface Clients {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let clients: Clients | null = null;

/** Firebase browser SDK, initialised once. Null in demo mode (no Firebase config). */
export function firebase(): Clients | null {
  if (!firebaseEnabled || typeof window === 'undefined') return null;
  if (clients) return clients;
  const app = getApps().length ? getApp() : initializeApp(publicEnv.firebase);

  // App Check proves requests come from this site, not a script. Skipped against emulators.
  if (publicEnv.recaptchaSiteKey && !publicEnv.useEmulators) {
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(publicEnv.recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  const storage = getStorage(app);
  if (publicEnv.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  clients = { app, auth, db, functions, storage };
  return clients;
}

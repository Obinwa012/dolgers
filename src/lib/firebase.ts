import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the NEXT_PUBLIC_FIREBASE_* env vars are present. */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;

/** Local development against `firebase emulators:start` (see README). */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true";

function firebaseApp(): FirebaseApp | null {
  if (!firebaseEnabled) return null;
  if (!app) {
    const existing = getApps().length > 0;
    app = existing ? getApp() : initializeApp(config);
    if (useEmulators && !existing) {
      connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
    }
  }
  return app;
}

export function db(): Firestore | null {
  const a = firebaseApp();
  return a ? getFirestore(a) : null;
}

export function auth(): Auth | null {
  const a = firebaseApp();
  return a ? getAuth(a) : null;
}

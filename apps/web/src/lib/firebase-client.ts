'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';

let auth: Auth | null = null;

/** Firebase Auth in the browser, used only to sign in. Null when the web config is missing. */
export function firebaseAuth(): Auth | null {
  if (auth) return auth;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR) connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR, { disableWarnings: true });
  return auth;
}

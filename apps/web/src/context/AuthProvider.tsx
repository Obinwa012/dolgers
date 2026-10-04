'use client';

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DolgersClaims, UserProfile } from '@dolgers/shared';
import { firebaseEnabled } from '@/lib/env';
import { firebase } from '@/lib/firebase/client';

interface AuthState {
  /** False until Firebase has reported the first auth state. */
  ready: boolean;
  enabled: boolean;
  user: User | null;
  /** A signed-in, non-guest account. */
  isMember: boolean;
  claims: DolgersClaims;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: { email: string; password: string; firstName: string; lastName: string; marketingOptIn: boolean }): Promise<void>;
  signInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Signs in anonymously if nobody is signed in, so guests can check out. */
  ensureSession(): Promise<User>;
  /** Re-reads roles after an admin changes them. */
  refreshClaims(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function writeProfile(user: User, p: Omit<UserProfile, 'uid' | 'createdAt' | 'email'>) {
  const fb = firebase()!;
  const profile: UserProfile = { uid: user.uid, email: user.email ?? '', createdAt: Date.now(), ...p };
  await setDoc(doc(fb.db, 'users', user.uid), profile);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!firebaseEnabled);
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<DolgersClaims>({});

  useEffect(() => {
    const fb = firebase();
    if (!fb) return;
    return onIdTokenChanged(fb.auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setClaims({
          admin: token.claims.admin === true,
          vendorId: typeof token.claims.vendorId === 'string' ? token.claims.vendorId : undefined,
          vendorRole: token.claims.vendorRole === 'owner' || token.claims.vendorRole === 'staff' ? token.claims.vendorRole : undefined,
        });
      } else {
        setClaims({});
      }
      setReady(true);
    });
  }, []);

  const auth = () => {
    const fb = firebase();
    if (!fb) throw new Error('Accounts are not available in demo mode.');
    return fb.auth;
  };

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth(), email, password);
  }, []);

  const signUp = useCallback(async (input: { email: string; password: string; firstName: string; lastName: string; marketingOptIn: boolean }) => {
    const a = auth();
    let u: User;
    if (a.currentUser?.isAnonymous) {
      // Upgrade the guest session so orders placed as a guest stay with the new account.
      u = (await linkWithCredential(a.currentUser, EmailAuthProvider.credential(input.email, input.password))).user;
    } else {
      u = (await createUserWithEmailAndPassword(a, input.email, input.password)).user;
    }
    await updateProfile(u, { displayName: `${input.firstName} ${input.lastName}`.trim() });
    await writeProfile(u, { firstName: input.firstName, lastName: input.lastName, marketingOptIn: input.marketingOptIn });
    await u.getIdToken(true);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const a = auth();
    const provider = new GoogleAuthProvider();
    let u: User;
    if (a.currentUser?.isAnonymous) {
      // Keep a guest's orders: link Google to the guest session. If that Google account already
      // has a DOLGERS account, sign into it instead.
      try {
        u = (await linkWithPopup(a.currentUser, provider)).user;
      } catch (err) {
        const credential = err instanceof FirebaseError ? GoogleAuthProvider.credentialFromError(err) : null;
        if (!credential || (err as FirebaseError).code !== 'auth/credential-already-in-use') throw err;
        u = (await signInWithCredential(a, credential)).user;
      }
    } else {
      u = (await signInWithPopup(a, provider)).user;
    }
    const fb = firebase()!;
    if (!(await getDoc(doc(fb.db, 'users', u.uid))).exists()) {
      const [firstName = '', ...rest] = (u.displayName ?? '').split(' ');
      await writeProfile(u, { firstName: firstName.slice(0, 60), lastName: rest.join(' ').slice(0, 60), marketingOptIn: false });
    }
    await u.getIdToken(true);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth(), email);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth());
  }, []);

  const ensureSession = useCallback(async () => {
    const a = auth();
    if (a.currentUser) return a.currentUser;
    return (await signInAnonymously(a)).user;
  }, []);

  const refreshClaims = useCallback(async () => {
    const u = auth().currentUser;
    if (u) await u.getIdToken(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      enabled: firebaseEnabled,
      user,
      isMember: !!user && !user.isAnonymous,
      claims,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut,
      ensureSession,
      refreshClaims,
    }),
    [ready, user, claims, signIn, signUp, signInWithGoogle, resetPassword, signOut, ensureSession, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

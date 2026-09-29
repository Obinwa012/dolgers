"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db, firebaseEnabled } from "@/lib/firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function need() {
  const a = auth();
  if (!a) throw new Error("Firebase is not configured. Add your keys to .env.local.");
  return a;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    const a = auth();
    if (!a) return;
    return onAuthStateChanged(a, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthCtx = {
    user,
    loading,
    enabled: firebaseEnabled,
    async login(email, password) {
      await signInWithEmailAndPassword(need(), email, password);
    },
    async register(name, email, password) {
      const cred = await createUserWithEmailAndPassword(need(), email, password);
      await updateProfile(cred.user, { displayName: name });
      const d = db();
      if (d)
        await setDoc(
          doc(d, "users", cred.user.uid),
          { name, email, createdAt: serverTimestamp() },
          { merge: true },
        );
    },
    async loginWithGoogle() {
      await signInWithPopup(need(), new GoogleAuthProvider());
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(need(), email);
    },
    async logout() {
      await signOut(need());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

/** Friendly messages for common Firebase Auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/popup-closed-by-user": "Sign-in popup was closed.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  };
  return map[code] ?? (err instanceof Error ? err.message : "Something went wrong.");
}

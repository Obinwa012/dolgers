'use client';

import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebase } from '@/lib/firebase/client';
import { useAuth } from './AuthProvider';

interface WishlistState {
  ids: Set<string>;
  has(productId: string): boolean;
  toggle(productId: string): Promise<void>;
}

const KEY = 'dolgers.wishlist.v1';
const WishlistContext = createContext<WishlistState | null>(null);

function loadLocal(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

/** Guests keep a wishlist in the browser; members keep it in their account (merged on sign-in). */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isMember } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fb = firebase();
    if (!isMember || !fb || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      setIds(new Set(loadLocal()));
      return;
    }
    const col = collection(fb.db, 'users', user.uid, 'wishlist');
    const local = loadLocal();
    if (local.length) {
      Promise.all(local.map((id) => setDoc(doc(col, id), { productId: id, addedAt: serverTimestamp() }).catch(() => undefined)))
        .then(() => localStorage.removeItem(KEY));
    }
    return onSnapshot(col, (snap) => setIds(new Set(snap.docs.map((d) => d.id))), () => undefined);
  }, [isMember, user]);

  const toggle = useCallback(async (productId: string) => {
    const fb = firebase();
    const has = ids.has(productId);
    if (isMember && fb && user) {
      const ref = doc(fb.db, 'users', user.uid, 'wishlist', productId);
      if (has) await deleteDoc(ref);
      else await setDoc(ref, { productId, addedAt: serverTimestamp() });
      return;
    }
    const next = new Set(ids);
    if (has) next.delete(productId);
    else next.add(productId);
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  }, [ids, isMember, user]);

  const value = useMemo<WishlistState>(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}

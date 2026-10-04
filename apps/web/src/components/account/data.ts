'use client';

import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { Order, SavedAddress, UserProfile } from '@dolgers/shared';
import { useAuth } from '@/context/AuthProvider';
import { firebase } from '@/lib/firebase/client';

export interface Loaded<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/** The signed-in member's placed orders, newest first. Abandoned checkouts are left out. */
export function useMyOrders(max = 50): Loaded<Order[]> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<Loaded<Order[]> & { uid?: string }>({ data: [], loading: true, error: null });
  useEffect(() => {
    const fb = firebase();
    if (!fb || !uid) return;
    const q = query(collection(fb.db, 'orders'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => setState({ uid, loading: false, error: null, data: snap.docs.map((d) => d.data() as Order).filter((o) => o.paidAt !== null) }),
      () => setState({ uid, loading: false, error: 'We could not load your orders. Please refresh the page.', data: [] }),
    );
  }, [uid, max]);
  return state.uid === uid ? state : { data: [], loading: true, error: null };
}

export function useMyAddresses(): Loaded<SavedAddress[]> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<Loaded<SavedAddress[]> & { uid?: string }>({ data: [], loading: true, error: null });
  useEffect(() => {
    const fb = firebase();
    if (!fb || !uid) return;
    return onSnapshot(
      collection(fb.db, 'users', uid, 'addresses'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SavedAddress);
        list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.lastName.localeCompare(b.lastName));
        setState({ uid, loading: false, error: null, data: list });
      },
      () => setState({ uid, loading: false, error: 'We could not load your addresses.', data: [] }),
    );
  }, [uid]);
  return state.uid === uid ? state : { data: [], loading: true, error: null };
}

export function useMyProfile(): Loaded<UserProfile | null> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<Loaded<UserProfile | null> & { key?: string }>({ data: null, loading: true, error: null });
  const key = uid ?? '';
  useEffect(() => {
    const fb = firebase();
    if (!fb || !uid) return;
    let live = true;
    getDoc(doc(fb.db, 'users', uid))
      .then((snap) => live && setState({ key, loading: false, error: null, data: snap.exists() ? (snap.data() as UserProfile) : null }))
      .catch(() => live && setState({ key, loading: false, error: 'We could not load your profile.', data: null }));
    return () => { live = false; };
  }, [uid, key]);
  return state.key === key ? state : { data: null, loading: true, error: null };
}

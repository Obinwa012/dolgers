'use client';

import {
  getCountFromServer,
  onSnapshot,
  type DocumentReference,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

function readError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  if (code === 'permission-denied') return 'You do not have access to this data.';
  if (code === 'failed-precondition') return 'This list needs a Firestore index that is still building. Try again in a few minutes.';
  if (code === 'unavailable') return 'You appear to be offline. We will retry when the connection is back.';
  return errorMessage(err);
}

interface Snapshot<T> {
  key: string | null;
  data: T;
  error: string | null;
}

/**
 * Live Firestore query. `key` identifies the query: when it changes, the listener is replaced.
 * Pass null to skip. Every document gets its id merged in as `id`.
 */
export function useLiveQuery<T>(key: string | null, make: (db: Firestore) => Query) {
  const [state, setState] = useState<Snapshot<T[]>>({ key: null, data: [], error: null });
  useEffect(() => {
    const fb = firebase();
    if (!fb || !key) return;
    return onSnapshot(
      make(fb.db),
      (snap) => setState({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), error: null }),
      (err) => setState({ key, data: [], error: readError(err) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the query
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : [], loading: !!key && !current, error: current ? state.error : null };
}

/** Live single document. `data` is null when the document does not exist. */
export function useLiveDoc<T>(key: string | null, make: (db: Firestore) => DocumentReference) {
  const [state, setState] = useState<Snapshot<T | null>>({ key: null, data: null, error: null });
  useEffect(() => {
    const fb = firebase();
    if (!fb || !key) return;
    return onSnapshot(
      make(fb.db),
      (snap) => setState({ key, data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, error: null }),
      (err) => setState({ key, data: null, error: readError(err) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the document
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : null, loading: !!key && !current, error: current ? state.error : null };
}

/** One-off aggregate count. Null while loading or when the count failed. */
export function useCount(key: string | null, make: (db: Firestore) => Query): number | null {
  const [state, setState] = useState<{ key: string | null; count: number | null }>({ key: null, count: null });
  useEffect(() => {
    const fb = firebase();
    if (!fb || !key) return;
    let live = true;
    getCountFromServer(make(fb.db))
      .then((res) => { if (live) setState({ key, count: res.data().count }); })
      .catch(() => { if (live) setState({ key, count: null }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the query
  }, [key]);
  return state.key === key ? state.count : null;
}

/** Runs a callable with pending, error and success state for the UI. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = useCallback(async <R,>(fn: () => Promise<R>, successMessage?: string | ((result: R) => string)): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      if (successMessage) setSuccess(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result;
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => { setError(null); setSuccess(null); }, []);
  return { pending, error, success, run, reset, setError };
}

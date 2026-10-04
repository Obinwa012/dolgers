'use client';

import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { errorMessage } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

/** Follow a maker. Members only: writes users/{uid}/follows/{vendorId}. */
export function FollowButton({ vendorId, vendorSlug, onDark = true }: { vendorId: string; vendorSlug: string; onDark?: boolean }) {
  const { ready, user, isMember } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fb = firebase();
    if (!fb || !user || !isMember) return;
    let cancelled = false;
    getDoc(doc(fb.db, 'users', user.uid, 'follows', vendorId))
      .then((snap) => !cancelled && setFollowing(snap.exists()))
      .catch(() => !cancelled && setFollowing(false));
    return () => {
      cancelled = true;
    };
  }, [user, isMember, vendorId]);

  const base = `btn ${onDark ? 'btn-light' : 'btn-primary'} min-w-[132px]`;

  if (!ready || !isMember || !user) {
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(`/brands/${vendorSlug}`)}`} className={base}>
        Follow
      </Link>
    );
  }

  const onClick = async () => {
    const fb = firebase();
    if (!fb) return;
    setBusy(true);
    setError('');
    const ref = doc(fb.db, 'users', user.uid, 'follows', vendorId);
    try {
      if (following) {
        await deleteDoc(ref);
        setFollowing(false);
      } else {
        await setDoc(ref, { vendorId, followedAt: serverTimestamp() });
        setFollowing(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={onClick} disabled={busy || following === null} aria-pressed={!!following} className={base}>
        {following ? 'Following' : 'Follow'}
      </button>
      {error ? <span role="alert" className={`mt-2 text-xs ${onDark ? 'text-white/80' : 'text-danger'}`}>{error}</span> : null}
    </span>
  );
}

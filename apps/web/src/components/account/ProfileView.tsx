'use client';

import { doc, setDoc } from 'firebase/firestore';
import { useState, type FormEvent } from 'react';
import type { UserProfile } from '@dolgers/shared';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { errorMessage } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';
import { useMyProfile } from './data';

export function ProfileView() {
  const { user } = useAuth();
  const profile = useMyProfile();
  if (profile.loading) return <Spinner label="Loading your profile" />;
  return <ProfileForm initial={profile.data} uid={user!.uid} email={user!.email ?? ''} loadError={profile.error} />;
}

function ProfileForm({
  initial, uid, email, loadError,
}: {
  initial: UserProfile | null;
  uid: string;
  email: string;
  loadError: string | null;
}) {
  const { user, resetPassword } = useAuth();
  const [firstName, setFirstName] = useState(initial?.firstName ?? user?.displayName?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? user?.displayName?.split(' ').slice(1).join(' ') ?? '');
  const [optIn, setOptIn] = useState(initial?.marketingOptIn ?? false);
  const [createdAt, setCreatedAt] = useState<number | null>(initial?.createdAt ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const hasPassword = user?.providerData.some((p) => p.providerId === 'password') ?? false;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) return setMessage({ tone: 'error', text: 'Enter your first and last name.' });
    if (f.length > 60 || l.length > 60) return setMessage({ tone: 'error', text: 'Names can be up to 60 characters.' });
    const fb = firebase();
    if (!fb) return;
    setBusy(true);
    try {
      // The rules accept exactly these fields and keep createdAt fixed.
      const record: UserProfile = {
        uid,
        email: (initial?.email || email).slice(0, 200),
        firstName: f,
        lastName: l,
        marketingOptIn: optIn,
        createdAt: createdAt ?? Date.now(),
      };
      await setDoc(doc(fb.db, 'users', uid), record);
      setCreatedAt(record.createdAt);
      setMessage({ tone: 'success', text: 'Your profile is saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    try {
      await resetPassword(email);
      setMessage({ tone: 'success', text: `We sent a link to ${email} to choose a new password.` });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    }
  };

  return (
    <div>
      <h1 className="display text-[36px] md:text-[44px]">Profile</h1>
      {loadError ? <div className="mt-6"><Notice tone="error">{loadError}</Notice></div> : null}
      <form onSubmit={save} noValidate className="mt-10 max-w-xl space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-first" className="field-label">First name</label>
            <input id="profile-first" className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={60} />
          </div>
          <div>
            <label htmlFor="profile-last" className="field-label">Last name</label>
            <input id="profile-last" className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={60} />
          </div>
        </div>
        <div>
          <label htmlFor="profile-email" className="field-label">Email</label>
          <input id="profile-email" className="field bg-stone text-muted" value={email} readOnly aria-describedby="profile-email-hint" />
          <p id="profile-email-hint" className="mt-1.5 text-xs text-muted">To change the email on your account, contact us.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          Email me about new arrivals and private sales
        </label>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      {hasPassword ? (
        <section className="mt-14 max-w-xl border-t border-line pt-8" aria-labelledby="pw-heading">
          <h2 id="pw-heading" className="label">Password</h2>
          <p className="mt-3 text-sm text-muted">We will email you a secure link to choose a new password.</p>
          <button type="button" className="btn btn-secondary mt-5" onClick={() => void sendReset()}>Send reset link</button>
        </section>
      ) : null}
    </div>
  );
}

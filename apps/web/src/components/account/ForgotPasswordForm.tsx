'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { authErrorMessage, withNext } from './authHelpers';

export function ForgotPasswordForm({ next }: { next: string }) {
  const { enabled, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!z.email().safeParse(email.trim()).success) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Do not reveal whether an account exists for this email.
      if (code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <Notice tone="success">If an account exists for {email.trim()}, a link to reset your password is on its way. It can take a few minutes; check your spam folder too.</Notice>
        <Link href={withNext('/sign-in', next)} className="btn btn-primary mt-8 w-full">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      {!enabled ? <div className="mb-6"><Notice>Accounts are not available in this demo.</Notice></div> : null}
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="field-label">Email</label>
          <input id="reset-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} disabled={!enabled} />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={!enabled || busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="mt-10 border-t border-line pt-8 text-sm text-muted">
        Remembered it? <Link href={withNext('/sign-in', next)} className="text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Notice } from '@/components/ui';
import { DrawerLink } from '@/components/RouteDrawer';
import { useAuth } from '@/context/AuthProvider';
import { authErrorMessage, withNext } from './authHelpers';
import { GoogleButton, OrDivider } from './GoogleButton';

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const { ready, enabled, isMember, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && isMember && !busy) router.replace(next);
  }, [ready, isMember, busy, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div>
      {!enabled ? <div className="mb-6"><Notice>Accounts are not available in this demo. Browse and fill your bag freely.</Notice></div> : null}
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="signin-email" className="field-label">Email</label>
          <input id="signin-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={200} disabled={!enabled} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="signin-password" className="field-label">Password</label>
            <DrawerLink href={withNext('/forgot-password', next)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">Forgot password?</DrawerLink>
          </div>
          <input id="signin-password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={!enabled} />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={!enabled || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <OrDivider />
      <GoogleButton disabled={!enabled} onDone={() => router.replace(next)} onError={setError} />
      <p className="mt-10 border-t border-line pt-8 text-sm text-muted">
        New to DOLGERS?{' '}
        <DrawerLink href={withNext('/register', next)} className="text-ink underline underline-offset-4">Create an account</DrawerLink>
      </p>
    </div>
  );
}

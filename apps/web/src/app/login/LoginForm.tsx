'use client';

import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, input } from '@/components/ui.tsx';
import { firebaseAuth } from '@/lib/firebase-client.ts';
import { signIn } from '@/server/actions/auth.ts';

function friendly(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Email or password is incorrect.';
  if (/too-many-requests/.test(code)) return 'Too many attempts. Wait a few minutes or reset your password.';
  if (/network/.test(code)) return 'Network error. Check your connection.';
  return (e instanceof Error ? e.message : 'Sign-in failed').replace(/^Firebase:\s*/, '');
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const auth = firebaseAuth();
      if (!auth) throw new Error('Firebase sign-in is not configured for this site.');
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const r = await signIn(await cred.user.getIdToken());
      await auth.signOut(); // the server session is what keeps you signed in
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError('');
    setNote('');
    const auth = firebaseAuth();
    if (!auth || !email.trim()) {
      setError('Enter your email first, then choose “Forgot password”.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNote('If that email has an account, a reset link is on its way.');
    } catch (err) {
      setError(friendly(err));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-paper p-6 shadow-xl">
      <label className="mb-1 block text-sm font-semibold" htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required className={`${input} mb-4`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="mb-1 block text-sm font-semibold" htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete="current-password" required className={`${input} mb-4`} value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p role="alert" className="mb-4 text-sm text-bad">{error}</p>}
      {note && <p className="mb-4 text-sm text-good">{note}</p>}
      <button type="submit" disabled={busy || !email || !password} className={`${btn.primary} w-full py-2.5`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" onClick={reset} className="mt-3 w-full text-center text-sm text-ink-soft hover:text-ink">
        Forgot password
      </button>
    </form>
  );
}

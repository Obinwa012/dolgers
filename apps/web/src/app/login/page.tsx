'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebase } from '@/lib/firebase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fb = firebase();
      if (!fb) {
        setError('Firebase is not configured on this site.');
        return;
      }
      const cred = await signInWithEmailAndPassword(fb.auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      // Clean up the common Firebase messages.
      setError(msg.replace(/^Firebase:\s*/, '').split(' (auth/')[0]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-paper border border-line rounded-lg p-8">
        <h1 className="font-display text-3xl mb-1">Dolgers</h1>
        <p className="text-muted text-sm mb-6">Import System — admin sign in</p>
        <label className="block text-sm mb-2" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full border border-line rounded px-3 py-2 mb-4 bg-paper"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="block text-sm mb-2" htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          className="w-full border border-line rounded px-3 py-2 mb-4 bg-paper"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full bg-ink text-paper rounded py-2 disabled:opacity-40"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

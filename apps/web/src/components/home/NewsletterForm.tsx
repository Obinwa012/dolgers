'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { accountApi, errorMessage } from '@/lib/firebase/api';

/** "Join the list": signs a guest in anonymously so the callable knows who is asking, then subscribes. */
export function NewsletterForm() {
  const { enabled, ensureSession } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState('error');
      setMessage('Enter a valid email address.');
      return;
    }
    if (!enabled) {
      setState('done');
      setMessage('Thanks! Sign-ups open when the store launches. This preview is running in demo mode, so nothing was saved.');
      return;
    }
    setState('busy');
    setMessage('');
    try {
      await ensureSession();
      await accountApi({ action: 'subscribe', data: { email: value } });
      setState('done');
      setMessage("You're on the list. We'll be in touch when there's something worth sharing.");
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(errorMessage(err));
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor="newsletter-email" className="label text-white/60">Email address</label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
          aria-invalid={state === 'error'}
          aria-describedby={message ? 'newsletter-message' : undefined}
          className="h-12 w-full border-b border-white/40 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40 focus:border-white"
        />
        <button type="submit" className="btn btn-light shrink-0" disabled={state === 'busy'}>
          {state === 'busy' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      <p id="newsletter-message" aria-live="polite" className={`mt-3 min-h-5 text-[13px] ${state === 'error' ? 'text-[#f0b4a8]' : 'text-white/70'}`}>
        {message}
      </p>
    </form>
  );
}

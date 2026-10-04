'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { MIN_PASSWORD, authErrorMessage, withNext } from './authHelpers';
import { GoogleButton, OrDivider } from './GoogleButton';

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password', string>>;

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const { ready, enabled, isMember, signUp } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', marketingOptIn: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && isMember && !busy) router.replace(next);
  }, [ready, isMember, busy, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: Errors = {};
    if (!form.firstName.trim()) errs.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) errs.lastName = 'Enter your last name.';
    if (!z.email().safeParse(form.email.trim()).success) errs.email = 'Enter a valid email address.';
    if (form.password.length < MIN_PASSWORD) errs.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (form.password.length > 128) errs.password = 'Use 128 characters or fewer.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        marketingOptIn: form.marketingOptIn,
      });
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  const input = (key: 'firstName' | 'lastName' | 'email' | 'password', label: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`reg-${key}`} className="field-label">{label}</label>
      <input
        id={`reg-${key}`}
        className={`field ${errors[key] ? 'border-danger' : ''}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `reg-${key}-error` : key === 'password' ? 'reg-password-hint' : undefined}
        disabled={!enabled}
        {...props}
      />
      {errors[key] ? <p id={`reg-${key}-error`} className="mt-1.5 text-xs text-danger">{errors[key]}</p> : null}
    </div>
  );

  return (
    <div>
      {!enabled ? <div className="mb-6"><Notice>Accounts are not available in this demo.</Notice></div> : null}
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {input('firstName', 'First name', { autoComplete: 'given-name', maxLength: 60 })}
          {input('lastName', 'Last name', { autoComplete: 'family-name', maxLength: 60 })}
        </div>
        {input('email', 'Email', { type: 'email', autoComplete: 'email', maxLength: 200 })}
        <div>
          {input('password', 'Password', { type: 'password', autoComplete: 'new-password', minLength: MIN_PASSWORD, maxLength: 128 })}
          {!errors.password ? <p id="reg-password-hint" className="mt-1.5 text-xs text-muted">At least {MIN_PASSWORD} characters.</p> : null}
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-ink"
            checked={form.marketingOptIn}
            onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })}
            disabled={!enabled}
          />
          Email me about new arrivals and private sales
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={!enabled || busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
        <p className="text-xs text-muted">
          By creating an account you agree to our <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{' '}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>
      <OrDivider />
      <GoogleButton disabled={!enabled} onDone={() => router.replace(next)} onError={setError} />
      <p className="mt-10 border-t border-line pt-8 text-sm text-muted">
        Already have an account?{' '}
        <Link href={withNext('/sign-in', next)} className="text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </div>
  );
}

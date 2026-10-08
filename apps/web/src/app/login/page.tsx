import { redirect } from 'next/navigation';
import { currentAdmin } from '@/server/auth.ts';
import { LoginForm } from './LoginForm.tsx';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentAdmin()) redirect('/');
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="stitch mb-6 rounded-md bg-tag px-6 py-5 text-center">
          <p className="display text-5xl tracking-wide">DOLGERS</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Admin</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

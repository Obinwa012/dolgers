"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage, useAuth } from "@/context/AuthProvider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, enabled, login, register, loginWithGoogle, resetPassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    run(() => (mode === "login" ? login(email, password) : register(String(f.get("name")).trim(), email, password)));
  }

  const isLogin = mode === "login";
  return (
    <div className="container-x max-w-md py-16">
      <h1 className="text-center font-display text-4xl uppercase">{isLogin ? "Log in" : "Create account"}</h1>
      {!enabled && (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firebase isn&apos;t configured yet. Add your keys to <code>.env.local</code> to enable sign-in.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {!isLogin && <input name="name" required placeholder="Full name" className="input" autoComplete="name" />}
        <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" id="email" />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          className="input"
          autoComplete={isLogin ? "current-password" : "new-password"}
        />
        {error && <p className="text-sm text-sale" role="alert">{error}</p>}
        {info && <p className="text-sm text-emerald-700" role="status">{info}</p>}
        <button disabled={busy || !enabled} className="btn btn-brand w-full">
          {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
        </button>
      </form>

      {isLogin && (
        <button
          type="button"
          disabled={!enabled}
          className="mt-3 text-sm underline disabled:opacity-50"
          onClick={() => {
            const email = (document.getElementById("email") as HTMLInputElement | null)?.value.trim();
            if (!email) return setError("Enter your email above first.");
            run(async () => {
              await resetPassword(email);
              setInfo("Password reset email sent.");
            });
          }}
        >
          Forgot password?
        </button>
      )}

      <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button disabled={busy || !enabled} onClick={() => run(loginWithGoogle)} className="btn btn-outline w-full normal-case">
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Continue with Google
      </button>

      <p className="mt-8 text-center text-sm">
        {isLogin ? "New to Dolgers? " : "Already have an account? "}
        <Link href={`/${isLogin ? "register" : "login"}?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 underline">
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </div>
  );
}

/**
 * Only allow same-origin paths after login. A prefix check isn't enough: browsers treat
 * "/\evil.com" (and tab/newline variants) as "//evil.com", so resolve the URL and compare origins.
 */
function safeNext(raw: string | null): string {
  const fallback = "/account";
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const base = "https://dolgers.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

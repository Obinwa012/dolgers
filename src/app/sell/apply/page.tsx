"use client";

import { sendEmailVerification } from "firebase/auth";
import { CircleCheck, Clock, MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { api } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/marketplace";
import type { Category, SellerApplication } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  sole_proprietor: "Sole proprietor",
  llc: "LLC",
  corporation: "Corporation",
  partnership: "Partnership",
};

export default function ApplyPage() {
  const { user, loading } = useAuth();
  const [app, setApp] = useState<SellerApplication | null | undefined>(undefined);
  const [isSeller, setIsSeller] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  // user.emailVerified and the ID token's email_verified claim are both cached; this forces a refresh.
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ application: SellerApplication | null; seller: unknown; categories: Category[] }>(user, "/api/seller")
      .then((d) => {
        setApp(d.application);
        setCategories(d.categories ?? []);
        setIsSeller(Boolean(d.seller));
      })
      .catch((e) => {
        setApp(null);
        setError(e.message);
      });
  }, [user]);

  if (loading) return <div className="container-x py-20 text-center text-muted">Loading…</div>;
  if (!user)
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <h1 className="font-display text-3xl uppercase">Apply to sell</h1>
        <p className="mt-3 text-muted">Sign in or create an account first. You&apos;ll manage your store from it.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?next=/sell/apply" className="btn btn-brand">Log in</Link>
          <Link href="/register?next=/sell/apply" className="btn btn-outline">Create account</Link>
        </div>
      </div>
    );
  if (app === undefined) return <div className="container-x py-20 text-center text-muted">Loading…</div>;

  if (isSeller || app?.status === "approved")
    return (
      <Status icon={<CircleCheck className="h-14 w-14 text-emerald-600" />} title="You're approved">
        <p>Head to your dashboard to verify your business with Stripe and add your first listings.</p>
        <Link href="/seller" className="btn btn-brand mt-6">Open seller dashboard</Link>
      </Status>
    );
  if (app?.status === "pending")
    return (
      <Status icon={<Clock className="h-14 w-14 text-amber-500" />} title="Application received">
        <p>We review applications within 2 business days and will email {app.email} with the outcome.</p>
      </Status>
    );

  if (!user.emailVerified && !verified)
    return (
      <Status icon={<MailCheck className="h-14 w-14 text-brand-700" />} title="Verify your email first">
        <p>We need a verified email address for every seller. We&apos;ll send a link to {user.email}.</p>
        {verifySent ? (
          <>
            <p className="mt-5 text-sm text-emerald-700" role="status">Sent. Click the link in the email, then come back here.</p>
            <button
              className="btn btn-outline mt-4"
              onClick={async () => {
                await user.reload();
                if (!user.emailVerified) return setError("Not verified yet. Check your inbox (and spam) for the link.");
                await user.getIdToken(true);
                setError("");
                setVerified(true);
              }}
            >
              I&apos;ve verified my email
            </button>
          </>
        ) : (
          <button
            className="btn btn-brand mt-6"
            onClick={() => sendEmailVerification(user).then(() => setVerifySent(true), (e) => setError(e.message))}
          >
            Send verification email
          </button>
        )}
        {error && <p className="mt-3 text-sm text-sale" role="alert">{error}</p>}
      </Status>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setBusy(true);
    setError("");
    try {
      await user.getIdToken(true); // pick up a fresh email_verified claim
      await api(user, "/api/seller", {
        action: "apply",
        businessName: get("businessName"),
        legalName: get("legalName"),
        businessType: get("businessType"),
        country: get("country"),
        website: get("website"),
        phone: get("phone"),
        categories: f.getAll("categories").map(String),
        description: get("description"),
      });
      setApp({ ...(app ?? {}), status: "pending", email: user.email ?? "" } as SellerApplication);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="font-display text-4xl uppercase">Apply to sell on Torqline</h1>
      <p className="mt-2 text-muted">
        Step 1 of 2. After we approve your application, you&apos;ll verify your identity, business and bank details securely with
        Stripe. We never ask for tax IDs or bank numbers on this form.
      </p>
      {app?.status === "rejected" && (
        <p className="mt-4 rounded-lg border border-sale/30 bg-sale/5 p-4 text-sm">
          Your last application wasn&apos;t approved{app.note ? `: ${app.note}` : "."} You&apos;re welcome to apply again.
        </p>
      )}
      <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="Store name (shown to shoppers)"><input name="businessName" required maxLength={80} className="input" /></Field>
        <Field label="Registered business name"><input name="legalName" required maxLength={120} className="input" /></Field>
        <Field label="Business type">
          <select name="businessType" required className="input" defaultValue="">
            <option value="" disabled>Choose…</option>
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Country">
          <select name="country" required className="input" defaultValue="US">
            <option value="US">United States</option>
          </select>
        </Field>
        <Field label="Website (optional)"><input name="website" type="url" placeholder="https://" maxLength={200} className="input" /></Field>
        <Field label="Business phone"><input name="phone" type="tel" required maxLength={30} className="input" /></Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">What will you sell?</legend>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {categories.map((c) => (
              <label key={c.slug} className="flex items-center gap-2">
                <input type="checkbox" name="categories" value={c.slug} className="h-4 w-4 accent-brand-700" /> {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="About your business" wide>
          <textarea name="description" required minLength={30} maxLength={2000} rows={5} className="input" placeholder="What you sell, where you ship from, how long you've been trading…" />
        </Field>
        {error && <p className="text-sm text-sale sm:col-span-2" role="alert">{error}</p>}
        <div className="sm:col-span-2">
          <button disabled={busy} className="btn btn-brand">{busy ? "Submitting…" : "Submit application"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Status({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="container-x max-w-xl py-20 text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-4 font-display text-3xl uppercase">{title}</h1>
      <div className="mt-3 text-muted">{children}</div>
    </div>
  );
}

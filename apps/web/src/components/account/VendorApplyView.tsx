'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { DEPARTMENTS, vendorApplicationSchema, type Department, type VendorApplication } from '@dolgers/shared';
import { formatDate } from '@/components/checkout/format';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { errorMessage, vendorApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

type Form = {
  businessName: string;
  contactName: string;
  website: string;
  instagram: string;
  description: string;
  departments: Department[];
  shipsFrom: string;
};
type Errors = Partial<Record<keyof Form, string>>;

const MESSAGES: Record<keyof Form, string> = {
  businessName: 'Enter the name of your label.',
  contactName: 'Enter the name of the person we should talk to.',
  website: 'Enter a full web address starting with https://, or leave it blank.',
  instagram: 'Keep this under 60 characters.',
  description: 'Tell us about your label in at least 40 characters.',
  departments: 'Choose at least one department.',
  shipsFrom: 'Tell us where your orders ship from.',
};

const DEPT_LABEL: Record<Department, string> = { men: 'Men', boys: 'Boys' };
const NEXT = '/sell/apply';

export function VendorApplyView() {
  const { ready, enabled, user, isMember, claims, refreshClaims } = useAuth();
  const router = useRouter();
  const uid = isMember ? user?.uid : undefined;
  const [app, setApp] = useState<{ uid: string; data: VendorApplication | null } | null>(null);

  useEffect(() => {
    const fb = firebase();
    if (!fb || !uid) return;
    return onSnapshot(
      doc(fb.db, 'vendorApplications', uid),
      (snap) => setApp({ uid, data: snap.exists() ? (snap.data() as VendorApplication) : null }),
      () => setApp({ uid, data: null }),
    );
  }, [uid]);

  const wrap = (children: ReactNode) => (
    <div className="container-page py-14 md:py-20">
      <div className="mx-auto max-w-[640px]">
        <p className="label text-muted">Sell with DOLGERS</p>
        <h1 className="display mt-3 text-[40px] md:text-[52px]">Apply to sell</h1>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );

  if (!enabled) return wrap(<Notice>Applications are not available in this demo.</Notice>);
  if (!ready) return wrap(<Spinner />);
  if (!isMember) {
    return wrap(
      <>
        <p className="text-[15px] leading-relaxed text-ink-2">
          We review every label by hand. To apply, first create a DOLGERS account; we will use it to set up your store if you are accepted.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/register?next=${encodeURIComponent(NEXT)}`} className="btn btn-primary">Create an account</Link>
          <Link href={`/sign-in?next=${encodeURIComponent(NEXT)}`} className="btn btn-secondary">Sign in</Link>
        </div>
      </>,
    );
  }
  if (claims.vendorId) {
    return wrap(
      <>
        <p className="text-[15px] text-ink-2">Your store is already open on DOLGERS.</p>
        <Link href="/vendor" className="btn btn-primary mt-8">Open vendor dashboard</Link>
      </>,
    );
  }
  if (!app || app.uid !== uid) return wrap(<Spinner />);

  const existing = app.data;
  if (existing?.status === 'pending') {
    return wrap(
      <div className="bg-stone p-6 sm:p-8">
        <p className="label">Application received</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Thank you for applying with {existing.businessName} on {formatDate(existing.createdAt)}. We review every label by hand and will reply to {existing.email}, usually within a week.
        </p>
      </div>,
    );
  }
  if (existing?.status === 'approved') {
    return wrap(
      <div className="bg-stone p-6 sm:p-8">
        <p className="label">You are approved</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Welcome to DOLGERS, {existing.businessName}. Your store is ready to set up.</p>
        {existing.reviewNote ? <p className="mt-3 text-sm text-muted">{existing.reviewNote}</p> : null}
        <button
          type="button"
          className="btn btn-primary mt-6"
          onClick={async () => {
            await refreshClaims();
            router.push('/vendor');
          }}
        >
          Open vendor dashboard
        </button>
      </div>,
    );
  }

  return wrap(
    <>
      {existing?.status === 'rejected' ? (
        <div className="mb-8">
          <Notice>
            We were not able to accept your last application{existing.reviewNote ? `: ${existing.reviewNote}` : '.'} You are welcome to apply again.
          </Notice>
        </div>
      ) : (
        <p className="mb-10 text-[15px] leading-relaxed text-ink-2">
          DOLGERS is a home for independent labels making clothes for men and boys to last. Tell us about your work; we reply to every application.
        </p>
      )}
      <ApplicationForm initial={existing} />
    </>,
  );
}

function ApplicationForm({ initial }: { initial: VendorApplication | null }) {
  const { user } = useAuth();
  const [form, setForm] = useState<Form>({
    businessName: initial?.businessName ?? '',
    contactName: initial?.contactName ?? user?.displayName ?? '',
    website: initial?.website ?? '',
    instagram: initial?.instagram ?? '',
    description: initial?.description ?? '',
    departments: initial?.departments ?? [],
    shipsFrom: initial?.shipsFrom ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    let website = form.website.trim();
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    const parsed = vendorApplicationSchema.safeParse({ ...form, website, instagram: form.instagram.trim() });
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Form;
        if (key && !errs[key]) errs[key] = MESSAGES[key];
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await vendorApi({ action: 'apply', data: parsed.data });
      // The application listener above switches this page to "Application received".
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: Exclude<keyof Form, 'departments' | 'description'>, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`apply-${key}`} className="field-label">{label}</label>
      <input
        id={`apply-${key}`}
        className={`field ${errors[key] ? 'border-danger' : ''}`}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `apply-${key}-error` : hint ? `apply-${key}-hint` : undefined}
        {...extra}
      />
      {errors[key] ? <p id={`apply-${key}-error`} className="mt-1.5 text-xs text-danger">{errors[key]}</p> : hint ? <p id={`apply-${key}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {field('businessName', 'Label name', { maxLength: 80, autoComplete: 'organization' })}
        {field('contactName', 'Your name', { maxLength: 80, autoComplete: 'name' })}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {field('website', 'Website (optional)', { type: 'url', maxLength: 500, placeholder: 'https://', autoComplete: 'url' })}
        {field('instagram', 'Instagram (optional)', { maxLength: 60, placeholder: '@yourlabel' })}
      </div>
      <div>
        <label htmlFor="apply-description" className="field-label">About your label</label>
        <textarea
          id="apply-description"
          className={`field min-h-[160px] ${errors.description ? 'border-danger' : ''}`}
          value={form.description}
          onChange={set('description')}
          maxLength={2000}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby="apply-description-hint"
        />
        <p id="apply-description-hint" className={`mt-1.5 text-xs ${errors.description ? 'text-danger' : 'text-muted'}`}>
          {errors.description ?? 'What you make, how and where it is made, and who it is for.'} ({form.description.trim().length}/2000)
        </p>
      </div>
      <fieldset aria-describedby={errors.departments ? 'apply-departments-error' : undefined}>
        <legend className="field-label">Departments</legend>
        <div className="mt-1 flex flex-wrap gap-6">
          {DEPARTMENTS.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ink"
                checked={form.departments.includes(d)}
                onChange={(e) =>
                  setForm({ ...form, departments: e.target.checked ? [...form.departments, d] : form.departments.filter((x) => x !== d) })
                }
              />
              {DEPT_LABEL[d]}
            </label>
          ))}
        </div>
        {errors.departments ? <p id="apply-departments-error" className="mt-1.5 text-xs text-danger">{errors.departments}</p> : null}
      </fieldset>
      {field('shipsFrom', 'Orders ship from', { maxLength: 80, placeholder: 'City, State' }, 'DOLGERS sells within the United States, so your orders should ship from a US address.')}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send application'}</button>
    </form>
  );
}

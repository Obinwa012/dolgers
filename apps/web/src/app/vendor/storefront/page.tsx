'use client';

import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { vendorProfileSchema, type ProductImage as Img, type Vendor } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { useAction } from '@/components/dashboard/hooks';
import { ImageField } from '@/components/dashboard/ImageUpload';
import { ErrorText, Field, Loading, PageHeader, Panel, SuccessText } from '@/components/dashboard/ui';
import { errorMessage, vendorApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

interface ProfileForm {
  tagline: string;
  storyTitle: string;
  story: string;
  founded: string;
  basedIn: string;
  madeIn: string;
  shipsFrom: string;
  dispatchMin: string;
  dispatchMax: string;
  banner: Img | null;
  storyImage: Img | null;
}

function fromVendor(v: Vendor): ProfileForm {
  return {
    tagline: v.tagline ?? '',
    storyTitle: v.storyTitle ?? '',
    story: v.story ?? '',
    founded: v.facts?.founded ?? '',
    basedIn: v.facts?.basedIn ?? '',
    madeIn: v.facts?.madeIn ?? '',
    shipsFrom: v.facts?.shipsFrom ?? '',
    dispatchMin: String(v.facts?.dispatchDays?.[0] ?? 2),
    dispatchMax: String(v.facts?.dispatchDays?.[1] ?? 5),
    banner: v.banner ?? null,
    storyImage: v.storyImage ?? null,
  };
}

function ProfileEditor({ vendor }: { vendor: Vendor }) {
  const { vendorId } = useDashboard();
  const [form, setForm] = useState<ProfileForm>(() => fromVendor(vendor));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const action = useAction();
  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const min = Number.parseInt(form.dispatchMin, 10);
    const max = Number.parseInt(form.dispatchMax, 10);
    const parsed = vendorProfileSchema.safeParse({
      tagline: form.tagline,
      storyTitle: form.storyTitle,
      story: form.story,
      banner: form.banner,
      storyImage: form.storyImage,
      facts: { founded: form.founded, basedIn: form.basedIn, madeIn: form.madeIn, shipsFrom: form.shipsFrom, dispatchDays: [min, max] },
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.includes('dispatchDays')
        ? 'Dispatch days must be whole numbers (up to 30 and 60).'
        : issue.path.includes('url')
          ? `The ${issue.path[0] === 'banner' ? 'banner' : 'story'} photo is a placeholder. Upload a real photo or remove it.`
          : `${issue.path.join(' ')}: ${issue.message}`;
      setFieldError(where);
      return;
    }
    if (min > max) {
      setFieldError('The fastest dispatch time should not be longer than the slowest.');
      return;
    }
    setFieldError(null);
    void action.run(() => vendorApi({ action: 'updateProfile', data: parsed.data }), 'Saved. Your brand page will update within a minute.');
  };

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-8">
      <Panel title="Introduction">
        <div className="space-y-5">
          <Field id="tagline" label="Tagline" hint="One line under your name, e.g. Heavyweight knitwear from the Faroe Islands.">
            <input id="tagline" className="field" maxLength={200} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <ImageField label="Banner photo" value={form.banner} onChange={(img) => set('banner', img)} target={{ kind: 'vendor', vendorId }} aspect="aspect-[21/9]" />
        </div>
      </Panel>

      <Panel title="Your story">
        <div className="space-y-5">
          <Field id="storyTitle" label="Story heading" hint="Optional, e.g. Made slowly, in small runs.">
            <input id="storyTitle" className="field" maxLength={120} value={form.storyTitle} onChange={(e) => set('storyTitle', e.target.value)} />
          </Field>
          <Field id="story" label="Story" hint="Who founded the label, where it's made and what makes the work distinct. Two or three short paragraphs read best; leave a blank line between them.">
            <textarea id="story" className="field min-h-[220px]" maxLength={4000} value={form.story} onChange={(e) => set('story', e.target.value)} />
          </Field>
          <ImageField label="Story photo" value={form.storyImage} onChange={(img) => set('storyImage', img)} target={{ kind: 'vendor', vendorId }} aspect="aspect-[4/5]" />
        </div>
      </Panel>

      <Panel title="Facts">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="founded" label="Founded"><input id="founded" className="field" maxLength={20} placeholder="e.g. 2014" value={form.founded} onChange={(e) => set('founded', e.target.value)} /></Field>
          <Field id="basedIn" label="Based in"><input id="basedIn" className="field" maxLength={80} placeholder="e.g. Portland, Oregon" value={form.basedIn} onChange={(e) => set('basedIn', e.target.value)} /></Field>
          <Field id="madeIn" label="Made in"><input id="madeIn" className="field" maxLength={80} placeholder="e.g. USA" value={form.madeIn} onChange={(e) => set('madeIn', e.target.value)} /></Field>
          <Field id="shipsFrom" label="Ships from"><input id="shipsFrom" className="field" maxLength={80} placeholder="e.g. Portland, OR" value={form.shipsFrom} onChange={(e) => set('shipsFrom', e.target.value)} /></Field>
          <fieldset className="md:col-span-2">
            <legend className="field-label">Dispatch time, in working days from order</legend>
            <div className="flex items-center gap-3">
              <label htmlFor="dispatchMin" className="sr-only">Fastest</label>
              <input id="dispatchMin" type="number" min={0} max={30} className="field w-24" value={form.dispatchMin} onChange={(e) => set('dispatchMin', e.target.value)} />
              <span className="text-muted">to</span>
              <label htmlFor="dispatchMax" className="sr-only">Slowest</label>
              <input id="dispatchMax" type="number" min={0} max={60} className="field w-24" value={form.dispatchMax} onChange={(e) => set('dispatchMax', e.target.value)} />
              <span className="text-sm text-muted">days</span>
            </div>
          </fieldset>
        </div>
      </Panel>

      <div className="space-y-3">
        <ErrorText>{fieldError ?? action.error}</ErrorText>
        <SuccessText>{action.success}</SuccessText>
        <button type="submit" className="btn btn-primary" disabled={action.pending}>{action.pending ? 'Saving…' : 'Save storefront'}</button>
      </div>
    </form>
  );
}

export default function VendorStorefrontPage() {
  const { vendorId } = useDashboard();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fb = firebase();
    if (!fb) return;
    let live = true;
    getDoc(doc(fb.db, 'vendors', vendorId))
      .then((snap) => {
        if (!live) return;
        if (snap.exists()) setVendor(snap.data() as Vendor);
        else setError('We could not find your store.');
      })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, [vendorId]);

  return (
    <>
      <PageHeader
        eyebrow="Brand"
        title="Storefront"
        description="Your brand page on DOLGERS: the story, photos and facts shoppers read before they buy."
        actions={<Link href={`/brands/${vendorId}`} className="btn btn-secondary min-h-10">View brand page</Link>}
      />
      {error ? <ErrorText>{error}</ErrorText> : vendor ? <ProfileEditor vendor={vendor} /> : <Loading />}
    </>
  );
}

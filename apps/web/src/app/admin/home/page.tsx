'use client';

import { collection, doc, getDoc, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { homeContentSchema, type CallToAction, type HomeContent, type Product } from '@dolgers/shared';
import { formatDateTime } from '@/components/dashboard/format';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { ImageField } from '@/components/dashboard/ImageUpload';
import { ProductPicker } from '@/components/dashboard/ProductPicker';
import { ErrorText, Field, Loading, PageHeader, Panel, SuccessText } from '@/components/dashboard/ui';
import { errorMessage, adminApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

type HomeForm = Omit<HomeContent, 'updatedAt'>;

const CTA: CallToAction = { label: '', href: '/' };
const BLANK: HomeForm = {
  announcement: '',
  hero: { eyebrow: '', title: '', body: '', primary: { ...CTA }, secondary: { ...CTA }, image: null },
  departments: [],
  edit: { eyebrow: '', title: '', body: '', cta: { ...CTA }, image: null, productIds: [] },
  newArrivalIds: [],
};

function CtaFields({ id, label, value, onChange }: { id: string; label: string; value: CallToAction; onChange: (v: CallToAction) => void }) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="field-label">{label}</legend>
      <div>
        <label htmlFor={`${id}-label`} className="sr-only">{label} text</label>
        <input id={`${id}-label`} className="field" maxLength={40} placeholder="Button text" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-href`} className="sr-only">{label} link</label>
        <input id={`${id}-href`} className="field font-mono text-[13px]" maxLength={200} placeholder="/shop/men" value={value.href} onChange={(e) => onChange({ ...value, href: e.target.value })} />
      </div>
    </fieldset>
  );
}

function TextField({ id, label, value, onChange, max, area }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; area?: boolean }) {
  return (
    <Field id={id} label={label}>
      {area ? (
        <textarea id={id} className="field min-h-[88px]" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="field" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function HomeEditor({ initial, updatedAt }: { initial: HomeForm; updatedAt: number | null }) {
  const [form, setForm] = useState<HomeForm>(initial);
  const action = useAction();
  const live = useLiveQuery<Product>('products:live', (db) => query(collection(db, 'products'), where('status', '==', 'live'), orderBy('publishedAt', 'desc'), limit(300)));
  const hero = (patch: Partial<HomeForm['hero']>) => setForm((f) => ({ ...f, hero: { ...f.hero, ...patch } }));
  const edit = (patch: Partial<HomeForm['edit']>) => setForm((f) => ({ ...f, edit: { ...f.edit, ...patch } }));
  const dept = (i: number, patch: Partial<HomeForm['departments'][number]>) =>
    setForm((f) => ({ ...f, departments: f.departments.map((d, k) => (k === i ? { ...d, ...patch } : d)) }));

  const save = () => {
    const parsed = homeContentSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.join(' › ');
      const hint = issue.path.includes('href')
        ? 'Links must be paths on this site, starting with /.'
        : issue.path.includes('url')
          ? 'This image is a placeholder. Upload a real photo or remove it.'
          : issue.message;
      return action.setError(`${where}: ${hint}`);
    }
    void action.run(() => adminApi({ action: 'updateHome', data: parsed.data }), 'Saved. The home page updates within a minute.');
  };

  return (
    <form noValidate className="space-y-8 pb-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {updatedAt ? <p className="-mt-4 text-sm text-muted">Last saved {formatDateTime(updatedAt)}</p> : null}
      <Panel title="Announcement bar">
        <TextField id="announcement" label="Text (leave empty to hide)" max={140} value={form.announcement} onChange={(v) => setForm((f) => ({ ...f, announcement: v }))} />
      </Panel>

      <Panel title="Hero">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField id="hero-eyebrow" label="Eyebrow" max={60} value={form.hero.eyebrow} onChange={(v) => hero({ eyebrow: v })} />
            <TextField id="hero-title" label="Title" max={80} value={form.hero.title} onChange={(v) => hero({ title: v })} />
          </div>
          <TextField id="hero-body" label="Body" max={300} area value={form.hero.body} onChange={(v) => hero({ body: v })} />
          <CtaFields id="hero-primary" label="Primary button" value={form.hero.primary} onChange={(v) => hero({ primary: v })} />
          <CtaFields id="hero-secondary" label="Secondary button" value={form.hero.secondary} onChange={(v) => hero({ secondary: v })} />
          <ImageField label="Hero image" value={form.hero.image} onChange={(img) => hero({ image: img })} target={{ kind: 'admin' }} />
        </div>
      </Panel>

      <Panel
        title="Department tiles"
        actions={form.departments.length < 4 ? (
          <button type="button" className="label text-muted hover:text-ink" onClick={() => setForm((f) => ({ ...f, departments: [...f.departments, { title: '', body: '', cta: { ...CTA }, image: null }] }))}>
            Add tile
          </button>
        ) : null}
      >
        {form.departments.length === 0 ? <p className="text-sm text-muted">No tiles. Add up to four.</p> : (
          <div className="divide-y divide-line">
            {form.departments.map((d, i) => (
              <div key={i} className="space-y-4 py-6 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <h3 className="label text-muted">Tile {i + 1}</h3>
                  <button type="button" className="label text-muted hover:text-danger" onClick={() => setForm((f) => ({ ...f, departments: f.departments.filter((_, k) => k !== i) }))}>Remove</button>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <TextField id={`dept-${i}-title`} label="Title" max={40} value={d.title} onChange={(v) => dept(i, { title: v })} />
                  <TextField id={`dept-${i}-body`} label="Body" max={200} value={d.body} onChange={(v) => dept(i, { body: v })} />
                </div>
                <CtaFields id={`dept-${i}-cta`} label="Link" value={d.cta} onChange={(v) => dept(i, { cta: v })} />
                <ImageField label="Tile image" value={d.image} onChange={(img) => dept(i, { image: img })} target={{ kind: 'admin' }} aspect="aspect-[4/5]" />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="The edit">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField id="edit-eyebrow" label="Eyebrow" max={60} value={form.edit.eyebrow} onChange={(v) => edit({ eyebrow: v })} />
            <TextField id="edit-title" label="Title" max={80} value={form.edit.title} onChange={(v) => edit({ title: v })} />
          </div>
          <TextField id="edit-body" label="Body" max={400} area value={form.edit.body} onChange={(v) => edit({ body: v })} />
          <CtaFields id="edit-cta" label="Button" value={form.edit.cta} onChange={(v) => edit({ cta: v })} />
          <ImageField label="Edit image" value={form.edit.image} onChange={(img) => edit({ image: img })} target={{ kind: 'admin' }} aspect="aspect-[4/5]" />
          {live.loading ? <Loading /> : <ProductPicker label="Products in the edit" products={live.data} value={form.edit.productIds} max={4} onChange={(ids) => edit({ productIds: ids })} />}
        </div>
      </Panel>

      <Panel title="New arrivals">
        <p className="mb-4 text-sm text-muted">Pick up to 12 to feature, in order. Leave empty to show the newest live products automatically.</p>
        {live.error ? <ErrorText>{live.error}</ErrorText> : live.loading ? <Loading /> : (
          <ProductPicker label="New arrivals" products={live.data} value={form.newArrivalIds} max={12} onChange={(ids) => setForm((f) => ({ ...f, newArrivalIds: ids }))} />
        )}
      </Panel>

      <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur md:mx-0 md:px-0">
        <ErrorText>{action.error}</ErrorText>
        <SuccessText>{action.success}</SuccessText>
        <button type="submit" className="btn btn-primary" disabled={action.pending}>{action.pending ? 'Saving…' : 'Save home page'}</button>
      </div>
    </form>
  );
}

export default function AdminHomePage() {
  const [loaded, setLoaded] = useState<{ form: HomeForm; updatedAt: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fb = firebase();
    if (!fb) return;
    let live = true;
    getDoc(doc(fb.db, 'content', 'home'))
      .then((snap) => {
        if (!live) return;
        if (!snap.exists()) return setLoaded({ form: BLANK, updatedAt: null });
        const { updatedAt, ...rest } = snap.data() as HomeContent;
        setLoaded({ form: { ...BLANK, ...rest, hero: { ...BLANK.hero, ...rest.hero }, edit: { ...BLANK.edit, ...rest.edit } }, updatedAt: updatedAt ?? null });
      })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Content" title="Home page" description="Everything on the home page that isn't automatic. Links are paths on this site, like /shop/men or /brands/nordhavn." />
      {error ? <ErrorText>{error}</ErrorText> : loaded ? <HomeEditor initial={loaded.form} updatedAt={loaded.updatedAt} /> : <Loading />}
    </>
  );
}

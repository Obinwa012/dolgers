'use client';

import { collection, doc, getDoc, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { homeContentSchema, type CallToAction, type HomeContent, type HomeHero, type Product } from '@dolgers/shared';
import { formatDateTime } from '@/components/dashboard/format';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { ImageField } from '@/components/dashboard/ImageUpload';
import { ProductPicker } from '@/components/dashboard/ProductPicker';
import { ErrorText, Field, Loading, PageHeader, Panel, SuccessText } from '@/components/dashboard/ui';
import { errorMessage, adminApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';

type HomeForm = Omit<HomeContent, 'updatedAt'>;

const CTA: CallToAction = { label: '', href: '/' };
const emptyHero = (): HomeHero => ({
  eyebrow: '',
  title: '',
  body: '',
  primary: { ...CTA },
  secondary: { ...CTA },
  image: null,
});
const BLANK: HomeForm = {
  announcement: '',
  announcementSlides: [],
  hero: emptyHero(),
  heroSlides: [],
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
  const updateHero = (index: number, patch: Partial<HomeHero>) => {
    if (index === 0) return hero(patch);
    setForm((f) => ({ ...f, heroSlides: f.heroSlides.map((slide, i) => (i === index - 1 ? { ...slide, ...patch } : slide)) }));
  };
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
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="field-label mb-0">Additional rotating messages</p>
            {form.announcementSlides.length < 4 ? (
              <button type="button" className="label text-muted hover:text-ink" onClick={() => setForm((f) => ({ ...f, announcementSlides: [...f.announcementSlides, ''] }))}>
                Add message
              </button>
            ) : null}
          </div>
          {form.announcementSlides.map((message, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <TextField
                  id={`announcement-${index}`}
                  label={`Message ${index + 2}`}
                  max={140}
                  value={message}
                  onChange={(value) => setForm((f) => ({ ...f, announcementSlides: f.announcementSlides.map((item, i) => (i === index ? value : item)) }))}
                />
              </div>
              <button
                type="button"
                className="label shrink-0 pb-4 text-muted hover:text-danger"
                onClick={() => setForm((f) => ({ ...f, announcementSlides: f.announcementSlides.filter((_, i) => i !== index) }))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Hero slideshow"
        actions={form.heroSlides.length < 4 ? (
          <button type="button" className="label text-muted hover:text-ink" onClick={() => setForm((f) => ({ ...f, heroSlides: [...f.heroSlides, emptyHero()] }))}>
            Add slide
          </button>
        ) : null}
      >
        <p className="mb-5 text-sm text-muted">The homepage rotates through these campaigns. Add up to five slides; the first is shown first.</p>
        <div className="divide-y divide-line">
          {[form.hero, ...form.heroSlides].map((slide, index) => (
            <div key={index} className="space-y-5 py-6 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between">
                <h3 className="label text-muted">Slide {index + 1}</h3>
                {index > 0 ? (
                  <button type="button" className="label text-muted hover:text-danger" onClick={() => setForm((f) => ({ ...f, heroSlides: f.heroSlides.filter((_, i) => i !== index - 1) }))}>Remove</button>
                ) : null}
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <TextField id={`hero-${index}-eyebrow`} label="Eyebrow" max={60} value={slide.eyebrow} onChange={(v) => updateHero(index, { eyebrow: v })} />
                <TextField id={`hero-${index}-title`} label="Title" max={80} value={slide.title} onChange={(v) => updateHero(index, { title: v })} />
              </div>
              <TextField id={`hero-${index}-body`} label="Body" max={300} area value={slide.body} onChange={(v) => updateHero(index, { body: v })} />
              <CtaFields id={`hero-${index}-primary`} label="Primary button" value={slide.primary} onChange={(v) => updateHero(index, { primary: v })} />
              <CtaFields id={`hero-${index}-secondary`} label="Secondary button" value={slide.secondary} onChange={(v) => updateHero(index, { secondary: v })} />
              <ImageField label="Campaign image" value={slide.image} onChange={(img) => updateHero(index, { image: img })} target={{ kind: 'admin' }} aspect="aspect-[21/9]" />
            </div>
          ))}
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
        setLoaded({
          form: {
            ...BLANK,
            ...rest,
            announcementSlides: rest.announcementSlides ?? [],
            hero: { ...BLANK.hero, ...rest.hero },
            heroSlides: (rest.heroSlides ?? []).map((slide) => ({ ...BLANK.hero, ...slide })),
            edit: { ...BLANK.edit, ...rest.edit },
          },
          updatedAt: updatedAt ?? null,
        });
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

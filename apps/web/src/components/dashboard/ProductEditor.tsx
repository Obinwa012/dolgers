'use client';

import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  COLOURS,
  DEPARTMENTS,
  SIZE_LABELS,
  SIZE_SYSTEMS,
  productInputSchema,
  type Category,
  type Department,
  type InventoryRecord,
  type Product,
  type ProductImage as Img,
  type ProductInput,
  type ProductStatus,
  type SizeSystem,
} from '@dolgers/shared';
import { errorMessage, vendorApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';
import { useDashboard } from './DashboardShell';
import { centsToInput, parseDollars } from './format';
import { useLiveQuery } from './hooks';
import { ImageGallery } from './ImageUpload';
import { MoneyInput } from './MoneyInput';
import { ErrorText, Field, Loading, PageHeader, Panel, StatusBadge } from './ui';

const SYSTEM_LABEL: Record<SizeSystem, string> = {
  alpha: 'Letter sizes (XS–XXL)',
  'eu-shoe': 'Shoe sizes (EU 38–47)',
  age: 'Kids by age (2–15Y)',
  waist: 'Waist in inches (28–40)',
  'one-size': 'One size',
};

interface SizeRow {
  enabled: boolean;
  price: string;
  compareAt: string;
  stock: string;
  /** On-hand count when the editor opened; stock is only sent when it changes. */
  originalStock: number | null;
}

interface FormState {
  title: string;
  description: string;
  composition: string;
  care: string;
  fitNote: string;
  department: Department;
  categoryId: string;
  sizeSystem: SizeSystem;
  colourName: string;
  colourHex: string;
  images: Img[];
  related: string[];
  rows: Record<string, SizeRow>;
}

function emptyRows(system: SizeSystem): Record<string, SizeRow> {
  return Object.fromEntries(
    SIZE_LABELS[system].map((s) => [s, { enabled: system === 'one-size', price: '', compareAt: '', stock: '0', originalStock: null }]),
  );
}

function fromProduct(p: Product, stock: Record<string, number>): FormState {
  const rows = emptyRows(p.sizeSystem);
  for (const v of p.variants) {
    rows[v.size] = {
      enabled: true,
      price: centsToInput(v.price),
      compareAt: centsToInput(v.compareAtPrice),
      stock: String(stock[v.sku] ?? 0),
      originalStock: stock[v.sku] ?? null,
    };
  }
  return {
    title: p.title,
    description: p.description,
    composition: p.composition,
    care: p.care,
    fitNote: p.fitNote,
    department: p.department,
    categoryId: p.categoryId,
    sizeSystem: p.sizeSystem,
    colourName: p.colour.name,
    colourHex: p.colour.hex,
    images: p.images,
    related: p.related,
    rows,
  };
}

const BLANK: FormState = {
  title: '',
  description: '',
  composition: '',
  care: '',
  fitNote: '',
  department: 'men',
  categoryId: '',
  sizeSystem: 'alpha',
  colourName: '',
  colourHex: '#111111',
  images: [],
  related: [],
  rows: emptyRows('alpha'),
};

type Errors = Record<string, string>;

const SUBMITTED: Partial<Record<ProductStatus, string>> = {
  live: 'Your product is live.',
  in_review: 'Submitted. We will review it and email you, usually within two working days.',
  draft: 'Saved as a draft. Submit it for review when it is ready.',
};

/** Builds the upsertProduct payload and collects field errors the client can see. */
function toInput(form: FormState, id: string | undefined): { input: ProductInput | null; errors: Errors } {
  const errors: Errors = {};
  const sizes = SIZE_LABELS[form.sizeSystem].filter((s) => form.rows[s]?.enabled);
  const variants = sizes.map((size) => {
    const row = form.rows[size];
    const price = parseDollars(row.price);
    const compare = parseDollars(row.compareAt);
    const stock = Number.parseInt(row.stock, 10);
    if (price === null) errors[`size:${size}`] = 'Enter a price.';
    else if (price < 100) errors[`size:${size}`] = 'Prices start at $1.';
    else if (row.compareAt && compare === null) errors[`size:${size}`] = 'Compare-at price is not a number.';
    else if (compare !== null && compare <= price) errors[`size:${size}`] = 'Compare-at must be higher than the price, or empty.';
    if (!Number.isInteger(stock) || stock < 0) errors[`size:${size}`] = 'Stock must be a whole number.';
    const stockChanged = row.originalStock === null || stock !== row.originalStock;
    return {
      size,
      price: price ?? 0,
      compareAtPrice: compare,
      ...(stockChanged && Number.isInteger(stock) ? { stock } : {}),
    };
  });
  if (!sizes.length) errors.variants = 'Offer at least one size.';
  const raw = {
    ...(id ? { id } : {}),
    title: form.title,
    description: form.description,
    composition: form.composition,
    care: form.care,
    fitNote: form.fitNote,
    department: form.department,
    categoryId: form.categoryId,
    sizeSystem: form.sizeSystem,
    colour: { name: form.colourName, hex: form.colourHex },
    images: form.images,
    variants,
    related: form.related,
  };
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [head, index] = issue.path;
      let key = issue.path.join('.');
      if (head === 'variants' && typeof index === 'number') key = `size:${sizes[index]}`;
      else if (head === 'colour') key = 'colour';
      else if (head === 'images') key = 'images';
      if (key === 'images' && issue.path.includes('url')) {
        errors.images = errors.images ?? 'Some photos are placeholders. Remove them or upload real photos.';
        continue;
      }
      else if (head === 'categoryId') key = 'categoryId';
      if (!errors[key]) errors[key] = key === 'categoryId' ? 'Pick a category.' : issue.message;
    }
  }
  return { input: parsed.success && !Object.keys(errors).length ? parsed.data : null, errors };
}

/** Maps a server error like "data.title: Too small" onto a field. */
function serverFieldError(message: string): [string, string] | null {
  const m = message.match(/^data\.([\w.]+): (.*)$/);
  if (!m) return null;
  const path = m[1].split('.');
  if (path[0] === 'colour') return ['colour', m[2]];
  if (path[0] === 'images') return ['images', m[2]];
  if (path[0] === 'variants') return ['variants', m[2]];
  return [path[0], m[2]];
}

export function ProductEditor({ productId }: { productId?: string }) {
  const { vendorId } = useDashboard();
  const [loaded, setLoaded] = useState<{ product: Product | null; stock: Record<string, number> } | null>(productId ? null : { product: null, stock: {} });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fb = firebase();
    if (!fb || !productId) return;
    let live = true;
    (async () => {
      const snap = await getDoc(doc(fb.db, 'products', productId));
      if (!snap.exists()) throw new Error('We could not find that product.');
      const product = snap.data() as Product;
      if (product.vendorId !== vendorId) throw new Error('This product belongs to another store.');
      const inv = await getDocs(query(collection(fb.db, 'inventory'), where('vendorId', '==', vendorId), where('productId', '==', productId)));
      const stock = Object.fromEntries(inv.docs.map((d) => [d.id, (d.data() as InventoryRecord).onHand]));
      if (live) setLoaded({ product, stock });
    })().catch((err) => { if (live) setLoadError(errorMessage(err)); });
    return () => { live = false; };
  }, [productId, vendorId]);

  if (loadError) {
    return (
      <>
        <PageHeader title="Product" back={{ label: 'Products', href: '/vendor/products' }} />
        <ErrorText>{loadError}</ErrorText>
      </>
    );
  }
  if (!loaded) return <Loading label="Loading product" />;
  return <EditorForm key={productId ?? 'new'} product={loaded.product} initial={loaded.product ? fromProduct(loaded.product, loaded.stock) : BLANK} />;
}

function EditorForm({ product, initial }: { product: Product | null; initial: FormState }) {
  const { vendorId } = useDashboard();
  const router = useRouter();
  const created = useSearchParams().get('created') as ProductStatus | null;
  const [form, setForm] = useState<FormState>(initial);
  const [savedId, setSavedId] = useState<string | undefined>(product?.id);
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? 'draft');
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<'save' | 'submit' | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(
    created && SUBMITTED[created] ? { tone: 'success', text: SUBMITTED[created] } : null,
  );

  const categories = useLiveQuery<Category>('categories', (db) => query(collection(db, 'categories'), orderBy('order')));
  const own = useLiveQuery<Product>(`vendorProducts:${vendorId}`, (db) =>
    query(collection(db, 'products'), where('vendorId', '==', vendorId), orderBy('updatedAt', 'desc')));

  const dirty = JSON.stringify(form) !== savedSnapshot;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.data.map((c) => [c.id, c]));
    const label = (c: Category) => {
      const names: string[] = [];
      let cur: Category | undefined = c;
      while (cur) {
        names.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return names.slice(1).join(' › ');
    };
    return categories.data
      .filter((c) => c.department === form.department && c.path.length > 1)
      .map((c) => ({ id: c.id, label: label(c), path: c.path.join('/') }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [categories.data, form.department]);

  const sizes = SIZE_LABELS[form.sizeSystem];
  const updateRow = (size: string, patch: Partial<SizeRow>) =>
    setForm((f) => ({ ...f, rows: { ...f.rows, [size]: { ...f.rows[size], ...patch } } }));

  const changeSystem = (system: SizeSystem) => {
    setForm((f) => {
      const rows = emptyRows(system);
      // Keep anything already entered for sizes that exist in both systems.
      for (const s of SIZE_LABELS[system]) if (f.rows[s]) rows[s] = f.rows[s];
      return { ...f, sizeSystem: system, rows };
    });
  };

  const fillPrices = () => {
    const first = sizes.find((s) => form.rows[s].enabled && form.rows[s].price);
    if (!first) return;
    const { price, compareAt } = form.rows[first];
    setForm((f) => ({
      ...f,
      rows: Object.fromEntries(Object.entries(f.rows).map(([s, r]) => [s, r.enabled ? { ...r, price, compareAt } : r])),
    }));
  };

  const save = async (): Promise<string | null> => {
    const { input, errors: errs } = toInput(form, savedId);
    setErrors(errs);
    if (!input) {
      setMessage({ tone: 'error', text: 'Please fix the highlighted fields.' });
      return null;
    }
    try {
      const res = (await vendorApi({ action: 'upsertProduct', data: input })) as { id: string; status: ProductStatus };
      // Stock that was just saved becomes the new baseline.
      const rows = Object.fromEntries(
        Object.entries(form.rows).map(([s, r]) => [s, r.enabled ? { ...r, originalStock: Number.parseInt(r.stock, 10) } : r]),
      );
      const next = { ...form, rows };
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      setSavedId(res.id);
      setStatus(res.status);
      return res.id;
    } catch (err) {
      const text = errorMessage(err);
      const field = serverFieldError(text);
      if (field) setErrors({ [field[0]]: field[1] });
      setMessage({ tone: 'error', text });
      return null;
    }
  };

  const onSave = async () => {
    setPending('save');
    setMessage(null);
    const id = await save();
    if (id && !savedId) {
      router.replace(`/vendor/products/${id}?created=draft`);
      return;
    }
    if (id) setMessage({ tone: 'success', text: status === 'live' ? 'Saved. Your changes are live.' : 'Saved.' });
    setPending(null);
  };

  const onSubmit = async () => {
    setPending('submit');
    setMessage(null);
    const id = dirty || !savedId ? await save() : savedId;
    if (id) {
      try {
        const res = (await vendorApi({ action: 'submitProduct', data: { productId: id } })) as { status: ProductStatus };
        setStatus(res.status);
        if (!savedId) {
          router.replace(`/vendor/products/${id}?created=${res.status}`);
          return;
        }
        setMessage({ tone: 'success', text: SUBMITTED[res.status] ?? 'Submitted.' });
      } catch (err) {
        setMessage({ tone: 'error', text: errorMessage(err) });
      }
    }
    setPending(null);
  };

  const canSubmit = status === 'draft' || status === 'rejected' || status === 'archived';
  const relatedChoices = own.data.filter((p) => p.id !== savedId && p.status !== 'archived');

  return (
    <form
      noValidate
      onSubmit={(e) => { e.preventDefault(); void onSave(); }}
      className="pb-36 md:pb-24"
    >
      <PageHeader
        back={{ label: 'Products', href: '/vendor/products' }}
        eyebrow={savedId ? 'Edit product' : 'New product'}
        title={form.title || 'Untitled product'}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            {status === 'live' ? <span>Changes you save go live straight away.</span> : null}
            {status === 'in_review' ? <span>Our team is reviewing this product.</span> : null}
            {savedId && status === 'live' && product ? <Link href={`/products/${product.slug}`} className="underline underline-offset-4">View in store</Link> : null}
          </span>
        }
      />

      {status === 'rejected' && product?.reviewNote ? (
        <div className="mb-8"><ErrorText>Note from DOLGERS: {product.reviewNote}</ErrorText></div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Panel title="Details">
            <div className="space-y-5">
              <Field id="title" label="Title" error={errors.title}>
                <input id="title" className="field" maxLength={120} value={form.title} aria-invalid={!!errors.title}
                  placeholder="e.g. Double-faced wool overcoat" onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field id="description" label="Description" error={errors.description} hint="Plain text. Leave a blank line between paragraphs.">
                <textarea id="description" className="field min-h-[160px]" maxLength={4000} value={form.description}
                  onChange={(e) => set('description', e.target.value)} />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field id="composition" label="Composition" error={errors.composition}>
                  <textarea id="composition" className="field min-h-[88px]" maxLength={500} value={form.composition}
                    placeholder="e.g. 100% British wool. Lining: 100% cupro." onChange={(e) => set('composition', e.target.value)} />
                </Field>
                <Field id="care" label="Care" error={errors.care}>
                  <textarea id="care" className="field min-h-[88px]" maxLength={500} value={form.care}
                    placeholder="e.g. Dry clean only. Brush after wear." onChange={(e) => set('care', e.target.value)} />
                </Field>
              </div>
              <Field id="fitNote" label="Fit note" error={errors.fitNote} hint="Shown next to the size picker.">
                <input id="fitNote" className="field" maxLength={300} value={form.fitNote}
                  placeholder="e.g. Relaxed fit. Size down for a closer cut." onChange={(e) => set('fitNote', e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Photos">
            <ImageGallery
              images={form.images}
              target={{ kind: 'vendor', vendorId }}
              onChange={(next) => setForm((f) => ({ ...f, images: typeof next === 'function' ? next(f.images) : next }))}
            />
            {errors.images ? <p className="mt-2 text-xs text-danger">{errors.images}</p> : null}
          </Panel>

          <Panel
            title="Sizes, prices and stock"
            actions={<button type="button" className="label text-muted hover:text-ink" onClick={fillPrices}>Copy first price to all</button>}
          >
            <Field id="sizeSystem" label="Size system" className="mb-5 max-w-sm">
              <select id="sizeSystem" className="field" value={form.sizeSystem} onChange={(e) => changeSystem(e.target.value as SizeSystem)}>
                {SIZE_SYSTEMS.map((s) => <option key={s} value={s}>{SYSTEM_LABEL[s]}</option>)}
              </select>
            </Field>
            {errors.variants ? <p className="mb-3 text-xs text-danger">{errors.variants}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <caption className="sr-only">Sizes</caption>
                <thead>
                  <tr className="border-b border-ink text-left">
                    <th scope="col" className="label py-2 pr-3 font-medium text-muted">Size</th>
                    <th scope="col" className="label px-3 py-2 font-medium text-muted">Price</th>
                    <th scope="col" className="label px-3 py-2 font-medium text-muted">Compare at</th>
                    <th scope="col" className="label py-2 pl-3 font-medium text-muted">In stock</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => {
                    const row = form.rows[size];
                    const err = errors[`size:${size}`];
                    const key = size.replace(/[^A-Za-z0-9]/g, '_');
                    return (
                      <tr key={size} className={`border-b border-line align-top ${row.enabled ? '' : 'text-faint'}`}>
                        <td className="py-2 pr-3">
                          <label className="flex min-h-10 cursor-pointer items-center gap-3">
                            <input type="checkbox" className="h-4 w-4 accent-ink" checked={row.enabled}
                              onChange={(e) => updateRow(size, { enabled: e.target.checked })} />
                            <span className="font-medium">{size}</span>
                          </label>
                          {err ? <p className="text-xs text-danger">{err}</p> : null}
                        </td>
                        <td className="px-3 py-2">
                          <label htmlFor={`price-${key}`} className="sr-only">Price for {size}</label>
                          <MoneyInput id={`price-${key}`} className="w-28" value={row.price} disabled={!row.enabled}
                            aria-invalid={!!err} onChange={(v) => updateRow(size, { price: v })} />
                        </td>
                        <td className="px-3 py-2">
                          <label htmlFor={`compare-${key}`} className="sr-only">Compare-at price for {size}</label>
                          <MoneyInput id={`compare-${key}`} className="w-28" value={row.compareAt} disabled={!row.enabled}
                            placeholder="—" onChange={(v) => updateRow(size, { compareAt: v })} />
                        </td>
                        <td className="py-2 pl-3">
                          <label htmlFor={`stock-${key}`} className="sr-only">Stock for {size}</label>
                          <input id={`stock-${key}`} type="number" min={0} max={100000} step={1} inputMode="numeric"
                            className="field w-24 tabular-nums" value={row.stock} disabled={!row.enabled}
                            onChange={(e) => updateRow(size, { stock: e.target.value })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              Compare-at shows the original price struck through when an item is reduced. Leave it empty otherwise.
            </p>
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="Organize">
            <div className="space-y-5">
              <fieldset>
                <legend className="field-label">Department</legend>
                <div className="flex gap-2">
                  {DEPARTMENTS.map((d) => (
                    <label key={d} className={`label flex min-h-10 flex-1 cursor-pointer items-center justify-center border ${form.department === d ? 'border-ink bg-ink text-paper' : 'border-line-strong'}`}>
                      <input type="radio" name="department" value={d} className="sr-only" checked={form.department === d}
                        onChange={() => setForm((f) => ({ ...f, department: d, categoryId: '' }))} />
                      {d === 'men' ? 'Men' : 'Boys'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id="category" label="Category" error={errors.categoryId}>
                <select id="category" className="field" value={form.categoryId} aria-invalid={!!errors.categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">{categories.loading ? 'Loading…' : 'Choose a category'}</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Colour">
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field id="colourName" label="Name" error={errors.colour}>
                  <input id="colourName" className="field" maxLength={40} value={form.colourName} placeholder="e.g. Navy"
                    onChange={(e) => set('colourName', e.target.value)} />
                </Field>
                <Field id="colourHex" label="Swatch">
                  <input id="colourHex" type="color" className="h-12 w-14 cursor-pointer border border-line-strong bg-paper p-1"
                    value={form.colourHex} onChange={(e) => set('colourHex', e.target.value)} />
                </Field>
              </div>
              <div>
                <p className="field-label">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {COLOURS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={form.colourHex.toLowerCase() === c.hex && form.colourName === c.name}
                      onClick={() => setForm((f) => ({ ...f, colourName: c.name, colourHex: c.hex }))}
                      className="h-7 w-7 border border-line-strong outline-offset-2 aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-ink"
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Complete the look">
            <p className="mb-3 text-xs text-muted">Pick up to 8 of your other products to show alongside this one.</p>
            {own.loading ? <Loading /> : relatedChoices.length === 0 ? (
              <p className="text-sm text-muted">Add more products to link them here.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {relatedChoices.map((p) => {
                  const checked = form.related.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-ink"
                          checked={checked}
                          disabled={!checked && form.related.length >= 8}
                          onChange={(e) => set('related', e.target.checked ? [...form.related, p.id] : form.related.filter((r) => r !== p.id))}
                        />
                        <span className="min-w-0 truncate">{p.title}</span>
                        {p.status !== 'live' ? <span className="ml-auto shrink-0 text-xs text-faint">{p.status === 'in_review' ? 'In review' : p.status}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="min-h-5 text-sm" aria-live="polite">
            {message ? (
              <span className={message.tone === 'error' ? 'text-danger' : 'text-success'}>{message.text}</span>
            ) : dirty ? (
              <span className="text-muted">Unsaved changes</span>
            ) : savedId ? (
              <span className="text-muted">All changes saved</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-secondary min-h-10 flex-1 md:flex-none" disabled={!!pending}>
              {pending === 'save' ? 'Saving…' : savedId ? 'Save changes' : 'Save draft'}
            </button>
            {canSubmit ? (
              <button type="button" className="btn btn-primary min-h-10 flex-1 md:flex-none" disabled={!!pending} onClick={() => void onSubmit()}>
                {pending === 'submit' ? 'Submitting…' : 'Submit for review'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}

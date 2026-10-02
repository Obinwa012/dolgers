"use client";

import type { User } from "firebase/auth";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
import { FITS } from "@/lib/marketplace";
import type { Brand, Category, Product } from "@/lib/types";

/** Seller listings: edit price/stock/visibility inline, or add a new listing. */
export default function Listings({
  user, products, categories, brands, canCreate, onChange,
}: {
  user: User;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  canCreate: boolean;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{products.length} listing{products.length === 1 ? "" : "s"}</p>
        {canCreate ? (
          <button onClick={() => setAdding((v) => !v)} className="btn btn-brand"><Plus className="h-4 w-4" /> {adding ? "Close" : "New listing"}</button>
        ) : (
          <p className="text-sm text-muted">New listings need the store&apos;s catalog seeded in Firestore.</p>
        )}
      </div>
      {adding && (
        <NewListing user={user} categories={categories} brands={brands} onDone={() => { setAdding(false); onChange(); }} />
      )}
      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted">No listings yet.</p>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => <ListingRow key={p.id} user={user} product={p} onSaved={onChange} />)}
        </ul>
      )}
    </div>
  );
}

function ListingRow({ user, product, onSaved }: { user: User; product: Product; onSaved: () => void }) {
  const [variants, setVariants] = useState(() => product.variants.map((v) => ({ id: v.id, name: v.name, price: String(v.price), compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "" })));
  const [stock, setStock] = useState(String(product.stock));
  const [active, setActive] = useState((product.listingStatus ?? "active") === "active");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(user, "/api/seller", {
        action: "updateListing",
        productId: product.id,
        stock: Number(stock),
        listingStatus: active ? "active" : "inactive",
        variants: variants.map((v) => ({ id: v.id, name: v.name, price: Number(v.price), compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined })),
      });
      setMsg({ ok: true, text: "Saved. The storefront updates within 5 minutes." });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/products/${product.slug}`} className="font-medium hover:text-brand-700">{product.title}</Link>
          <p className="text-xs text-muted">
            {product.slug} · from {money(Math.min(...product.variants.map((v) => v.price)))} ·{" "}
            <span className={active ? "text-emerald-700" : "text-muted"}>{active ? "Listed" : "Unlisted"}</span>
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-brand-700" /> Listed
        </label>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-[1fr_auto]">
        <table className="w-full">
          <thead className="text-left text-xs text-muted"><tr><th className="pb-1 font-normal">Option</th><th className="pb-1 font-normal">Price ($)</th><th className="pb-1 font-normal">Was ($)</th></tr></thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.id}>
                <td className="pr-2">{v.name}</td>
                <td className="py-1 pr-2"><input aria-label={`${v.name} price`} type="number" min={1} step="0.01" value={v.price} onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="input w-28! px-2! py-1.5!" /></td>
                <td className="py-1"><input aria-label={`${v.name} was price`} type="number" min={1} step="0.01" value={v.compareAtPrice} placeholder="—" onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, compareAtPrice: e.target.value } : x)))} className="input w-28! px-2! py-1.5!" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted">Stock<input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} className="input mt-1 w-24! px-2! py-1.5!" /></label>
          <button onClick={save} disabled={busy} className="btn btn-outline px-4! py-2!">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-sale"}`} role="status">{msg.text}</p>}
    </li>
  );
}

type OptRow = { name: string; price: string; compareAtPrice: string };

function NewListing({ user, categories, brands, onDone }: { user: User; categories: Category[]; brands: Brand[]; onDone: () => void }) {
  const [category, setCategory] = useState(categories[0]?.slug ?? "");
  const [opts, setOpts] = useState<OptRow[]>([{ name: "Standard", price: "", compareAtPrice: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cat = categories.find((c) => c.slug === category);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setBusy(true);
    setError("");
    try {
      await api(user, "/api/seller", {
        action: "createListing",
        title: get("title"),
        description: get("description"),
        category,
        subcategory: get("subcategory") || undefined,
        brand: get("brand"),
        fit: get("fit") || undefined,
        specs: get("specs").split("\n"),
        stock: Number(get("stock")),
        variants: opts.map((o) => ({ name: o.name, price: Number(o.price), compareAtPrice: o.compareAtPrice ? Number(o.compareAtPrice) : undefined })),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-sm font-semibold";
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg bg-surface p-5 sm:grid-cols-2">
      <label className={`${L} sm:col-span-2`}>Title<input name="title" required minLength={10} maxLength={150} className="input mt-1" /></label>
      <label className={L}>Brand
        <select name="brand" required className="input mt-1" defaultValue="">
          <option value="" disabled>Choose…</option>
          {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
      </label>
      <label className={L}>Fit
        <select name="fit" className="input mt-1" defaultValue="">
          <option value="">Not applicable</option>
          {FITS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className={L}>Category
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1">
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label className={L}>Subcategory
        <select name="subcategory" key={category} className="input mt-1" defaultValue="">
          <option value="">None</option>
          {cat?.subcategories?.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </label>
      <label className={`${L} sm:col-span-2`}>Description<textarea name="description" required minLength={20} maxLength={2000} rows={3} className="input mt-1" /></label>
      <label className={`${L} sm:col-span-2`}>Key specs <span className="font-normal text-muted">(one per line; use “Label: value” for the spec table)</span>
        <textarea name="specs" rows={4} className="input mt-1" placeholder={"Fabric: 100% linen\nLength: 112 cm"} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-semibold">Options</legend>
        <ul className="mt-2 space-y-2">
          {opts.map((o, i) => {
            const set = (patch: Partial<OptRow>) => setOpts((os) => os.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input aria-label="Option name" required value={o.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Black" className="input w-40! px-2! py-1.5!" />
                <input aria-label="Price" required type="number" min={1} step="0.01" value={o.price} onChange={(e) => set({ price: e.target.value })} placeholder="Price $" className="input w-28! px-2! py-1.5!" />
                <input aria-label="Was price" type="number" min={1} step="0.01" value={o.compareAtPrice} onChange={(e) => set({ compareAtPrice: e.target.value })} placeholder="Was $" className="input w-28! px-2! py-1.5!" />
                {opts.length > 1 && (
                  <button type="button" onClick={() => setOpts((os) => os.filter((_, j) => j !== i))} aria-label="Remove option" className="text-muted hover:text-sale"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
        {opts.length < 6 && (
          <button type="button" onClick={() => setOpts((os) => [...os, { name: "", price: "", compareAtPrice: "" }])} className="mt-2 text-sm font-semibold text-brand-700">+ Add option</button>
        )}
      </fieldset>
      <label className={L}>Stock (units)<input name="stock" type="number" required min={0} step={1} defaultValue={0} className="input mt-1" /></label>
      {error && <p className="text-sm text-sale sm:col-span-2" role="alert">{error}</p>}
      <div className="sm:col-span-2"><button disabled={busy} className="btn btn-brand">{busy ? "Publishing…" : "Publish listing"}</button></div>
    </form>
  );
}

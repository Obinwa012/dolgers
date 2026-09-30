"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Brand, Category } from "@/lib/types";

/** "Find Your Tool" fitment bar overlapping the hero. Routes to the catalog with filters. */
export default function Finder({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const router = useRouter();
  const [cat, setCat] = useState("");
  const [brand, setBrand] = useState("");
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (brand) params.set("brand", brand);
    const base = cat ? `/collections/${cat}` : "/collections/all";
    const qs = params.toString();
    router.push(`${base}${qs ? `?${qs}` : ""}`);
  };

  const field =
    "h-[46px] min-w-0 flex-1 rounded border border-slate-300 bg-[#fafafb] px-3.5 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="container-x relative z-10 -mt-[34px]">
      <form
        onSubmit={submit}
        className="flex flex-col gap-3.5 rounded border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] md:flex-row md:items-center md:px-6"
        role="search"
        aria-label="Find your tool"
      >
        <p className="shrink-0 font-display text-[15px] font-black uppercase tracking-wide text-ink">
          Find Your Tool
          <span className="block text-[11px] font-semibold tracking-[1px] text-muted">Shop by fitment</span>
        </p>
        <label className="sr-only" htmlFor="finder-cat">Category</label>
        <select id="finder-cat" value={cat} onChange={(e) => setCat(e.target.value)} className={field}>
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="finder-brand">Brand</label>
        <select id="finder-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={field}>
          <option value="">Select Brand</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="finder-q">SKU or keyword</label>
        <input
          id="finder-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Enter SKU or keyword…"
          className={field}
        />
        <button
          type="submit"
          className="h-[46px] shrink-0 rounded bg-ink px-8 font-display text-[13px] font-extrabold uppercase tracking-wider text-white hover:bg-accent"
        >
          Find It
        </button>
      </form>
    </div>
  );
}

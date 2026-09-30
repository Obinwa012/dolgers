"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Brand, Product } from "@/lib/types";

export type TabKey = "popular" | "featured" | "recent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "featured", label: "Featured" },
  { key: "recent", label: "Recent" },
];

/** Equipo-style tabbed product grid (Popular / Featured / Recent). */
export default function ShopTabs({
  products,
  brands,
}: {
  products: Record<TabKey, Product[]>;
  brands: Brand[];
}) {
  const [tab, setTab] = useState<TabKey>("popular");
  const brandOf = (slug: string) => brands.find((b) => b.slug === slug);

  return (
    <div>
      <div className="flex gap-1.5" role="tablist" aria-label="Product groups">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded border px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider transition ${
              tab === t.key
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" role="tabpanel">
        {products[tab].slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} brand={brandOf(p.brand)} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import Rail from "@/components/Rail";
import type { Brand, Category, Product } from "@/lib/types";

export default function FeaturedTabs({
  tabs,
  products,
  brands,
}: {
  tabs: Category[];
  products: Product[];
  brands: Brand[];
}) {
  const [active, setActive] = useState(tabs[0]?.slug);
  // Products tagged "featured" in this category. Ones that aren't already in the New Arrivals rail
  // come first, then by rating, so the two rails don't open on the same cards.
  const list = products
    .filter((p) => p.category === active && p.tags.includes("featured"))
    .sort(
      (a, b) =>
        Number(a.tags.includes("new")) - Number(b.tags.includes("new")) || b.rating - a.rating,
    );

  return (
    <>
      <div role="tablist" aria-label="Featured categories" className="no-scrollbar mx-auto mb-8 flex max-w-3xl justify-start gap-2 overflow-x-auto border-b border-slate-300 md:justify-center">
        {tabs.map((t) => (
          <button
            key={t.slug}
            role="tab"
            aria-selected={active === t.slug}
            onClick={() => setActive(t.slug)}
            className={`-mb-px shrink-0 border-b-2 px-4 pb-3 font-display text-lg md:px-6 md:text-2xl ${active === t.slug ? "border-brand-600 text-brand-600" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={active}>
        {list.length ? (
          <Rail label="Featured products" itemClass="w-[78%] sm:w-[45%] md:w-[31%] lg:w-[24%]">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />
            ))}
          </Rail>
        ) : (
          <p className="py-10 text-center text-muted">No products in this category yet.</p>
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@/lib/types";

const PAGE = 10;

/** "Picked for you" feed: category tabs over a dense five-column grid with a load-more button. */
export default function PickedForYou({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [tab, setTab] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => (tab === "all" ? products : products.filter((p) => p.category === tab)), [products, tab]);
  const tabs = [{ slug: "all", name: "For You" }, ...categories.filter((c) => products.some((p) => p.category === c.slug))];

  return (
    <div>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Browse by category">
        {tabs.map((t) => (
          <button
            key={t.slug}
            role="tab"
            aria-selected={tab === t.slug}
            onClick={() => {
              setTab(t.slug);
              setShown(PAGE);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${tab === t.slug ? "bg-accent font-bold text-white" : "bg-white text-[#555] hover:text-accent"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-5">
        {list.slice(0, shown).map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
      {shown < list.length ? (
        <div className="mt-6 text-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="btn btn-outline px-12">
            See more
          </button>
        </div>
      ) : (
        <p className="mt-6 text-center text-xs text-[#999]">That&apos;s everything for now.</p>
      )}
    </div>
  );
}

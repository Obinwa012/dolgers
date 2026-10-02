"use client";

import Link from "next/link";
import { useShop } from "@/context/ShopProvider";
import { money, onSale } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";
import ClothingArt from "./ClothingArt";

const saving = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice - v.price : 0)));

/**
 * Full-width category mega menu: columns of categories with their subcategory
 * links, plus a featured deal tile on the right.
 */
export default function MegaMenu({ categories, onNavigate }: { categories: Category[]; onNavigate: () => void }) {
  const { products } = useShop();
  const count = (catSlug: string, subSlug: string) =>
    products.filter((p) => p.category === catSlug && p.subcategory === subSlug).length;
  const deal = products.filter((p) => onSale(p) && p.stock > 0).sort((a, b) => saving(b) - saving(a))[0];

  return (
    <div className="absolute inset-x-0 top-full z-50 border-b border-slate-200 bg-white shadow-[0_28px_50px_-20px_rgba(0,0,0,0.25)]">
      <div className="container-x grid grid-cols-[1fr_290px] gap-10 py-8">
        <div className="grid grid-cols-3 gap-x-8 gap-y-8">
          {categories.map((c) => (
            <div key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                onClick={onNavigate}
                className="text-[13px] font-extrabold uppercase tracking-wider text-ink hover:text-accent"
              >
                {c.name}
              </Link>
              <ul className="mt-2.5 space-y-1.5">
                {(c.subcategories ?? []).map((s) => (
                  <li key={s.slug} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/collections/${c.slug}?sub=${s.slug}`}
                      onClick={onNavigate}
                      className="text-sm text-slate-500 transition hover:text-accent"
                    >
                      {s.name}
                    </Link>
                    <span className="text-[11px] text-slate-300">{count(c.slug, s.slug) || ""}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/collections/${c.slug}`}
                onClick={onNavigate}
                className="mt-2 inline-block text-xs font-bold uppercase tracking-wide text-slate-400 transition hover:text-accent"
              >
                Shop all &rarr;
              </Link>
            </div>
          ))}
        </div>

        <aside className="overflow-hidden rounded bg-ink text-white">
          {deal ? (
            <Link href={`/products/${deal.slug}`} onClick={onNavigate} className="group block p-5">
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">Top deal</p>
              <span className="mt-3 block aspect-[4/3] overflow-hidden rounded">
                <ClothingArt icon={deal.icon} tint={deal.tint} image={deal.image} alt={deal.title} variant="bold" className="transition duration-300 group-hover:scale-105" />
              </span>
              <p className="mt-3 line-clamp-2 text-sm font-medium">{deal.title}</p>
              <p className="mt-1.5 font-display text-xl font-extrabold text-accent">Save {money(saving(deal))}</p>
              <span className="mt-3 inline-block rounded bg-accent px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition group-hover:bg-accent-dark">
                Shop the deal
              </span>
            </Link>
          ) : (
            <Link href="/collections/all?sale=1" onClick={onNavigate} className="block p-5">
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">Deals</p>
              <p className="mt-3 font-display text-2xl font-extrabold uppercase leading-tight">See every deal in the store</p>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

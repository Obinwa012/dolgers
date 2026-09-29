"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useShop } from "@/context/ShopProvider";
import { money, onSale } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";
import ToolArt, { ICONS } from "./ToolArt";

const saving = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice - v.price : 0)));

/**
 * Desktop mega menu: categories on the left; the hovered/focused one's subcategories as image
 * tiles; and that category's biggest current deal on the right.
 */
export default function MegaMenu({ id, categories, onNavigate }: { id: string; categories: Category[]; onNavigate: () => void }) {
  const { products } = useShop();
  const [active, setActive] = useState(categories[0]?.slug);
  const cat = categories.find((c) => c.slug === active) ?? categories[0];
  if (!cat) return null;

  const inCat = products.filter((p) => p.category === cat.slug);
  const count = (sub: string) => inCat.filter((p) => p.subcategory === sub).length;
  const deal = inCat.filter((p) => onSale(p) && p.stock > 0).sort((a, b) => saving(b) - saving(a))[0];

  return (
    <div id={id} className="absolute inset-x-4 top-full z-50 grid grid-cols-[240px_1fr_260px] overflow-hidden rounded-b-lg border border-slate-200 bg-white shadow-2xl md:inset-x-7">
      <ul className="border-r bg-surface py-2" aria-label="Categories">
        {categories.map((c) => {
          const Icon = ICONS[c.icon];
          const on = c.slug === cat.slug;
          return (
            <li key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                onMouseEnter={() => setActive(c.slug)}
                onFocus={() => setActive(c.slug)}
                onClick={onNavigate}
                aria-current={on ? "true" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${on ? "bg-white font-semibold text-brand-700" : "hover:bg-white"}`}
              >
                <Icon className="h-4 w-4" style={{ color: c.tint }} />
                <span className="flex-1">{c.name}</span>
                <ChevronRight className={`h-4 w-4 ${on ? "text-brand-700" : "text-slate-300"}`} />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-2xl uppercase">{cat.name}</h3>
          <Link href={`/collections/${cat.slug}`} onClick={onNavigate} className="text-sm font-semibold text-brand-700 hover:underline">
            Shop all {inCat.length}
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-3 xl:grid-cols-4">
          {(cat.subcategories ?? []).map((s) => (
            <li key={s.slug}>
              <Link
                href={`/collections/${cat.slug}?sub=${s.slug}`}
                onClick={onNavigate}
                className="group flex flex-col overflow-hidden rounded-lg border hover:border-ink"
              >
                <span className="block aspect-[4/3] overflow-hidden">
                  <ToolArt icon={s.icon} tint={cat.tint} alt="" className="transition duration-300 group-hover:scale-105" />
                </span>
                <span className="px-3 py-2 text-sm font-medium group-hover:text-brand-700">{s.name}</span>
                <span className="-mt-2 px-3 pb-2 text-xs text-muted">{count(s.slug)} product{count(s.slug) === 1 ? "" : "s"}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link href={`/collections/${cat.slug}?sale=1`} onClick={onNavigate} className="rounded-full bg-sale/10 px-3 py-1 font-semibold text-sale hover:bg-sale/20">
            {cat.name} deals
          </Link>
          <Link href={`/collections/${cat.slug}?seller=torqline`} onClick={onNavigate} className="rounded-full bg-surface px-3 py-1 hover:bg-slate-200">
            Sold by Torqline
          </Link>
          <Link href={`/collections/${cat.slug}?stock=in`} onClick={onNavigate} className="rounded-full bg-surface px-3 py-1 hover:bg-slate-200">
            In stock
          </Link>
        </div>
      </div>

      <div className="border-l bg-ink p-5 text-white">
        {deal ? (
          <Link href={`/products/${deal.slug}`} onClick={onNavigate} className="group block">
            <p className="font-display text-sm uppercase tracking-widest text-accent">Top deal</p>
            <span className="mt-3 block aspect-square overflow-hidden rounded-lg">
              <ToolArt icon={deal.icon} tint={deal.tint} image={deal.image} alt={deal.title} variant="bold" className="transition duration-300 group-hover:scale-105" />
            </span>
            <p className="mt-3 line-clamp-2 text-sm">{deal.title}</p>
            <p className="mt-1 font-display text-2xl text-accent">Save {money(saving(deal))}</p>
          </Link>
        ) : (
          <Link href="/collections/all?sale=1" onClick={onNavigate} className="block">
            <p className="font-display text-sm uppercase tracking-widest text-accent">Deals</p>
            <p className="mt-3 font-display text-2xl uppercase">See every deal in the store</p>
          </Link>
        )}
      </div>
    </div>
  );
}

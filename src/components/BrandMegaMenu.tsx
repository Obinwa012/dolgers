"use client";

import Link from "next/link";
import type { Brand } from "@/lib/types";

/** Full-width brand mega menu: brand tiles plus a link to the full brand index. */
export default function BrandMegaMenu({ brands, onNavigate }: { brands: Brand[]; onNavigate: () => void }) {
  return (
    <div className="absolute inset-x-0 top-full z-50 border-b border-slate-200 bg-white shadow-[0_28px_50px_-20px_rgba(0,0,0,0.25)]">
      <div className="container-x py-8">
        <div className="mb-5 flex items-baseline justify-between">
          <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-ink">Shop by brand</h3>
          <Link href="/brands" onClick={onNavigate} className="text-xs font-bold uppercase tracking-wide text-slate-400 transition hover:text-accent">
            View all brands &rarr;
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/brands/${b.slug}`}
                onClick={onNavigate}
                className="group flex h-28 flex-col items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 text-center transition hover:border-ink hover:shadow-md"
              >
                <span
                  className="font-display text-base font-extrabold uppercase tracking-wide text-ink"
                  aria-label={b.name}
                >
                  {b.name}
                </span>
                <span className="h-[3px] w-8 rounded-full transition-all group-hover:w-12" style={{ background: b.color }} />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-slate-500">
          Every brand on Dolgers is an authorized seller shipping from US warehouses.
        </p>
      </div>
    </div>
  );
}

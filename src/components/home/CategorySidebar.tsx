import { ChevronRight } from "lucide-react";
import Link from "next/link";
import ClothingArt, { GarmentIcon } from "@/components/ClothingArt";
import { money, minPrice } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

/**
 * Left-hand category rail with hover flyouts, as on marketplace home pages. Pure CSS (group-hover and
 * group-focus-within), so it needs no client JavaScript and works from the keyboard.
 */
export default function CategorySidebar({ categories, products }: { categories: Category[]; products: Product[] }) {
  return (
    <nav aria-label="Shop by category" className="relative hidden rounded-xl bg-white lg:block">
      <ul className="flex h-full flex-col justify-between py-1.5">
        {categories.map((c) => {
          const popular = products.filter((p) => p.category === c.slug).sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 3);
          return (
            <li key={c.slug} className="group">
              <Link
                href={`/collections/${c.slug}`}
                className="flex items-center gap-2.5 px-3.5 py-1.5 transition group-hover:bg-brand-50 group-focus-within:bg-brand-50"
              >
                <GarmentIcon icon={c.icon} className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13.5px] font-bold text-ink group-hover:text-accent">{c.name}</span>
                  <span className="block truncate text-[11px] text-[#999]">
                    {(c.subcategories ?? []).slice(0, 2).map((s) => s.name.split(" ")[0]).join(" · ")}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#bbb]" aria-hidden />
              </Link>
              <div className="absolute left-full top-0 z-30 hidden h-full w-[620px] rounded-r-xl border border-l-0 border-[#f0f0f0] bg-white p-6 shadow-[8px_8px_30px_rgba(0,0,0,0.12)] group-focus-within:block group-hover:block">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-black text-ink">{c.name}</h3>
                  <Link href={`/collections/${c.slug}`} className="text-xs text-[#999] hover:text-accent">Shop all &rsaquo;</Link>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {(c.subcategories ?? []).map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/collections/${c.slug}?sub=${s.slug}`}
                        className="block rounded-full border border-[#eee] px-3.5 py-1.5 text-[13px] text-[#555] transition hover:border-accent hover:text-accent"
                      >
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {popular.length > 0 && (
                  <>
                    <p className="mb-2 mt-6 text-xs font-bold text-accent">Best sellers</p>
                    <ul className="grid grid-cols-3 gap-3">
                      {popular.map((p) => (
                        <li key={p.id}>
                          <Link href={`/products/${p.slug}`} className="group/item block">
                            <span className="block aspect-square overflow-hidden rounded-lg bg-surface">
                              <ClothingArt icon={p.icon} tint={p.tint} image={p.image} alt={p.title} className="transition group-hover/item:scale-105" />
                            </span>
                            <span className="mt-1.5 block truncate text-xs text-ink group-hover/item:text-accent">{p.title}</span>
                            <span className="text-sm font-bold text-accent">{money(minPrice(p))}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

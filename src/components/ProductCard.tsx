"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopProvider";
import { money, minPrice, onSale } from "@/lib/catalog";
import { SELF_SELLER } from "@/lib/marketplace";
import type { Brand, Product } from "@/lib/types";
import Stars from "./Stars";
import ToolArt from "./ToolArt";

/**
 * Equipo-style product tile: badge, spec line, sold-by, price-first,
 * charcoal "Add to Cart" button. 4px radius, 1200px grid.
 */
export default function ProductCard({ product, brand }: { product: Product; brand?: Brand }) {
  const { addToCart, toggleWish, inWishlist, sellerOf } = useShop();
  const v0 = product.variants.reduce((a, b) => (b.price < a.price ? b : a));
  const multi = product.variants.length > 1;
  const sale = onSale(product);
  const wished = inWishlist(product.id);
  const seller = sellerOf(product);
  const inStock = product.stock > 0;
  const pct =
    sale && v0.compareAtPrice
      ? Math.round((1 - v0.price / v0.compareAtPrice) * 100)
      : 0;
  const specLine = product.specs.slice(0, 3).join(" • ");

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_10px_26px_rgba(0,0,0,0.1)]">
      <div className="relative flex h-[190px] items-center justify-center border-b border-slate-100 bg-surface">
        <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden className="flex h-full w-full items-center justify-center">
          <ToolArt
            icon={product.icon}
            tint={product.tint}
            image={product.image}
            alt={product.title}
            className="h-[110px] w-[110px]"
          />
        </Link>
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {sale && (
            <span className="rounded bg-sale px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
              {pct > 0 ? `-${pct}%` : "Sale"}
            </span>
          )}
          {!sale && product.tags.includes("hot") && (
            <span className="rounded bg-[#1e88e5] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
              Hot
            </span>
          )}
          {!sale && product.tags.includes("new") && (
            <span className="rounded bg-[#43a047] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
              New
            </span>
          )}
          {product.tags.includes("clearance") && (
            <span className="rounded bg-ink px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-accent">
              Clearance
            </span>
          )}
        </div>
        <button
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2.5 top-2.5 grid h-[34px] w-[34px] place-items-center rounded border border-slate-200 bg-white opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-sale text-sale" : "text-muted"}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <Stars rating={product.rating} count={product.reviewCount} />
        <Link
          href={`/products/${product.slug}`}
          className="mt-1.5 line-clamp-2 min-h-[38px] text-sm font-bold leading-snug text-ink hover:text-accent"
        >
          {product.title}
        </Link>
        {specLine && <p className="mt-1.5 text-[11px] tracking-wide text-muted">{specLine}</p>}
        {seller && (
          <p className="mt-1 text-[11px] text-muted">
            Sold by{" "}
            <Link href={`/sellers/${seller.slug}`} className="font-bold text-ink/70 hover:text-accent">
              {seller.name === "Dolgers" ? "Dolgers Direct" : seller.name}
            </Link>
          </p>
        )}
        <p className="mt-2 font-display text-[22px] font-black text-ink">
          {multi && <span className="font-sans text-xs font-normal text-muted">From </span>}
          {money(minPrice(product))}
          {sale && v0.compareAtPrice && <s className="ml-2 text-[13px] font-semibold text-muted">{money(v0.compareAtPrice)}</s>}
        </p>
        <div className="mt-auto pt-2.5">
          {multi ? (
            <Link
              href={`/products/${product.slug}`}
              className="block w-full rounded bg-ink py-[11px] text-center font-display text-xs font-extrabold uppercase tracking-wider text-white hover:bg-accent"
            >
              Choose options
            </Link>
          ) : (
            <button
              onClick={() => addToCart(product.id, v0.id)}
              disabled={!inStock}
              className="w-full rounded bg-ink py-[11px] font-display text-xs font-extrabold uppercase tracking-wider text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inStock ? "Add to Cart" : "Out of stock"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

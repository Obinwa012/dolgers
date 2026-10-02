"use client";

import { Heart, Store } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopProvider";
import { minPrice, onSale } from "@/lib/catalog";
import { FREE_SHIPPING } from "@/lib/pricing";
import { soldLabel, splitPrice } from "@/lib/shopping";
import type { Brand, Product } from "@/lib/types";
import ClothingArt from "./ClothingArt";

/**
 * Marketplace-style product tile: square photo, two-line title with a hot/new tag, service chips,
 * a big orange price with the sold count beside it, and the shop name underneath.
 */
export default function ProductCard({ product }: { product: Product; brand?: Brand }) {
  const { addToCart, toggleWish, inWishlist, sellerOf } = useShop();
  const lowest = product.variants.reduce((a, b) => (b.price < a.price ? b : a));
  const highest = Math.max(...product.variants.map((v) => v.price));
  const priced = splitPrice(minPrice(product));
  const sale = onSale(product);
  const wasPrice = sale ? lowest.compareAtPrice : undefined;
  const pct = wasPrice ? Math.round((1 - lowest.price / wasPrice) * 100) : 0;
  const wished = inWishlist(product.id);
  const seller = sellerOf(product);
  const inStock = product.stock > 0;
  const single = product.variants.length === 1;
  const tag = product.tags.includes("hot") ? "Hot" : product.tags.includes("new") ? "New" : null;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-white ring-1 ring-transparent transition hover:shadow-[0_8px_24px_rgba(255,80,0,0.16)] hover:ring-accent/50">
      <div className="relative aspect-square overflow-hidden bg-surface">
        <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden className="block h-full w-full">
          <ClothingArt icon={product.icon} tint={product.tint} image={product.image} alt={product.title} className="transition duration-500 group-hover:scale-105" />
        </Link>
        {pct > 0 && (
          <span className="absolute left-0 top-2.5 rounded-r-full bg-sale px-2.5 py-0.5 text-[11px] font-bold text-white">-{pct}%</span>
        )}
        {product.tags.includes("clearance") && (
          <span className="absolute bottom-2 left-2 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-white">Clearance</span>
        )}
        <button
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm transition hover:bg-white [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-sale text-sale" : "text-[#666]"}`} />
        </button>
        {/* Quick add slides up from the bottom of the photo on hover or keyboard focus. */}
        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full bg-gradient-to-r from-accent-bright to-accent text-center transition duration-200 group-focus-within:translate-y-0 group-hover:translate-y-0 [@media(hover:hover)]:block">
          {single ? (
            <button
              onClick={() => addToCart(product.id, lowest.id)}
              disabled={!inStock}
              className="w-full py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {inStock ? "Add to cart" : "Sold out"}
            </button>
          ) : (
            <Link href={`/products/${product.slug}`} className="block py-2 text-[13px] font-bold text-white">
              Choose colour
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-3 pt-2">
        <Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-9 text-[13px] leading-[18px] text-ink hover:text-accent">
          {tag && (
            <span className={`mr-1 inline-block rounded-sm px-1 align-[1px] text-[10px] font-bold leading-4 text-white ${tag === "Hot" ? "bg-sale" : "bg-accent"}`}>{tag}</span>
          )}
          {product.title}
        </Link>
        <p className="mt-1.5 flex flex-wrap gap-1 text-[10px] leading-4">
          {minPrice(product) >= FREE_SHIPPING && <span className="rounded-sm border border-accent/60 px-1 text-accent">Free shipping</span>}
          {seller && <span className="rounded-sm border border-accent/60 px-1 text-accent">{seller.returnDays}-day returns</span>}
          {product.fit && product.fit !== "Regular" && <span className="rounded-sm border border-[#ddd] px-1 text-[#666]">{product.fit}</span>}
        </p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-bold text-accent">
            <span className="text-[13px]">$</span>
            <span className="text-[22px] leading-none">{priced.whole}</span>
            <span className="text-[13px]">{priced.cents}</span>
            {highest > minPrice(product) && <span className="text-[13px]" aria-label="and up">+</span>}
          </span>
          {wasPrice && <s className="text-xs text-[#999]">${wasPrice}</s>}
          <span className="ml-auto text-xs text-[#999]">{soldLabel(product)}</span>
        </p>
        {seller && (
          <Link href={`/sellers/${seller.slug}`} className="mt-1.5 flex items-center gap-1 text-[11px] text-[#999] transition hover:text-accent">
            <Store className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{seller.slug === "dolgers" ? "Dolgers Official Store" : seller.name}</span>
          </Link>
        )}
      </div>
    </article>
  );
}

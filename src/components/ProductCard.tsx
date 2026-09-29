"use client";

import { Flame, Heart, Star } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopProvider";
import { money, minPrice, onSale } from "@/lib/catalog";
import type { Brand, Product } from "@/lib/types";
import BrandMark from "./BrandMark";
import ToolArt from "./ToolArt";

export default function ProductCard({ product, brand }: { product: Product; brand?: Brand }) {
  const { addToCart, toggleWish, inWishlist } = useShop();
  const v0 = product.variants.reduce((a, b) => (b.price < a.price ? b : a));
  const multi = product.variants.length > 1;
  const sale = onSale(product);
  const wished = inWishlist(product.id);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#e5e7eb] transition hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,.2)]">
      <div className="relative aspect-square overflow-hidden">
        <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden>
          <ToolArt
            icon={product.icon}
            tint={product.tint}
            image={product.image}
            alt={product.title}
            className="transition duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {sale && <span className="rounded bg-sale px-2 py-0.5 text-xs font-bold uppercase text-white">Sale</span>}
          {product.tags.includes("hot") && (
            <span className="flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 text-xs font-bold uppercase text-white">
              <Flame className="h-3 w-3" /> Hot deal
            </span>
          )}
        </div>
        <button
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white shadow transition hover:bg-ink hover:text-white"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-sale text-sale" : ""}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        {brand && <BrandMark brand={brand} small />}
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-3 font-display text-[17px] leading-snug hover:text-brand-600"
        >
          {product.title}
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          {product.rating.toFixed(1)} ({product.reviewCount})
        </div>
        <p className="mt-auto flex items-baseline gap-2 font-display text-xl">
          {v0.compareAtPrice && v0.compareAtPrice > v0.price && (
            <s className="text-sm text-muted">{money(v0.compareAtPrice)}</s>
          )}
          <span className={sale ? "text-sale" : ""}>
            {multi ? "From " : ""}
            {money(minPrice(product))}
          </span>
        </p>
        {multi ? (
          <Link href={`/products/${product.slug}`} className="btn btn-outline mt-2 w-full">
            Choose options
          </Link>
        ) : (
          <button onClick={() => addToCart(product.id, v0.id)} className="btn btn-outline mt-2 w-full">
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}

"use client";

import { BadgeCheck, Flame, Heart, Tag } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopProvider";
import { money, minPrice, onSale } from "@/lib/catalog";
import { SELF_SELLER } from "@/lib/marketplace";
import type { Brand, Product } from "@/lib/types";
import BrandMark from "./BrandMark";
import DeliveryPromise from "./DeliveryPromise";
import Stars from "./Stars";
import ToolArt from "./ToolArt";

/**
 * Product tile. Every card carries rating, price, a delivery date (or pickup) and who sells it,
 * so it stays useful at 5–6 per row.
 */
export default function ProductCard({ product, brand }: { product: Product; brand?: Brand }) {
  const { addToCart, toggleWish, inWishlist, sellerOf } = useShop();
  const v0 = product.variants.reduce((a, b) => (b.price < a.price ? b : a));
  const multi = product.variants.length > 1;
  const sale = onSale(product);
  const wished = inWishlist(product.id);
  const seller = sellerOf(product);
  const inStock = product.stock > 0;
  const save = v0.compareAtPrice && v0.compareAtPrice > v0.price ? v0.compareAtPrice - v0.price : 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg bg-white text-ink shadow-[0_0_0_1px_#e5e7eb] transition hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,.2)]">
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
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {sale && <span className="rounded bg-sale px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Sale</span>}
          {product.tags.includes("hot") && (
            <span className="flex items-center gap-1 rounded bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">
              <Flame className="h-3 w-3" /> Hot deal
            </span>
          )}
          {product.tags.includes("clearance") && (
            <span className="flex items-center gap-1 rounded bg-ink px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent">
              <Tag className="h-3 w-3" /> Clearance
            </span>
          )}
        </div>
        <button
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white shadow transition hover:bg-ink hover:text-white"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-sale text-sale" : ""}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {brand && <BrandMark brand={brand} small />}
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-sm font-medium leading-snug hover:text-brand-600"
        >
          {product.title}
        </Link>
        <Stars rating={product.rating} count={product.reviewCount} />
        <p className="flex flex-wrap items-baseline gap-x-2 font-display text-lg">
          <span className={sale ? "text-sale" : ""}>
            {multi ? <span className="font-sans text-xs text-muted">From </span> : null}
            {money(minPrice(product))}
          </span>
          {save > 0 && <s className="text-xs text-muted">{money(v0.compareAtPrice!)}</s>}
        </p>
        {save > 0 && <p className="-mt-1 text-xs font-semibold text-sale">Save {money(save)}</p>}
        <DeliveryPromise seller={seller} inStock={inStock} compact />
        {seller && (
          <p className="text-xs text-muted">
            Sold by{" "}
            <Link href={`/sellers/${seller.slug}`} className="font-medium text-ink hover:text-brand-600">
              {seller.name}
            </Link>
            {seller.slug === SELF_SELLER ? (
              <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-brand-600" aria-label="First party" />
            ) : (
              <span> · {seller.rating.toFixed(1)}★</span>
            )}
          </p>
        )}
        <div className="mt-auto pt-1.5">
          {multi ? (
            <Link href={`/products/${product.slug}`} className="btn btn-outline w-full px-2! py-2! text-sm!">
              Choose options
            </Link>
          ) : (
            <button
              onClick={() => addToCart(product.id, v0.id)}
              disabled={!inStock}
              className="btn btn-outline w-full px-2! py-2! text-sm!"
            >
              {inStock ? "Add to cart" : "Out of stock"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

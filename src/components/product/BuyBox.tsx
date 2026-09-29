"use client";

import { Heart, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { Qty } from "@/components/CartDrawer";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export default function BuyBox({ product }: { product: Product }) {
  const { addToCart, toggleWish, inWishlist } = useShop();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const v = product.variants.find((x) => x.id === variantId)!;
  const sale = v.compareAtPrice && v.compareAtPrice > v.price;
  const wished = inWishlist(product.id);

  return (
    <div className="mt-6 space-y-6">
      <p className="flex items-baseline gap-3 font-display text-3xl">
        <span className={sale ? "text-sale" : ""}>{money(v.price)}</span>
        {sale && <s className="text-lg text-muted">{money(v.compareAtPrice!)}</s>}
        {sale && (
          <span className="rounded bg-sale px-2 py-0.5 font-sans text-xs font-bold uppercase text-white">
            Save {money(v.compareAtPrice! - v.price)}
          </span>
        )}
      </p>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Option: <span className="font-normal">{v.name}</span></legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((x) => (
              <button
                key={x.id}
                onClick={() => setVariantId(x.id)}
                aria-pressed={x.id === variantId}
                className={`rounded-md border px-4 py-2 text-sm ${x.id === variantId ? "border-ink bg-ink text-white" : "border-slate-300 hover:border-ink"}`}
              >
                {x.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className={`text-sm ${product.stock < 10 ? "text-orange-600" : "text-emerald-700"}`}>
        {product.stock <= 0 ? "Out of stock" : product.stock < 10 ? `Only ${product.stock} left in stock` : "In stock, ships today"}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Qty value={qty} onChange={(n) => setQty(Math.max(1, Math.min(99, product.stock > 0 ? product.stock : 99, n)))} />
        <button onClick={() => addToCart(product.id, variantId, qty)} disabled={product.stock <= 0} className="btn btn-brand flex-1">
          {product.stock <= 0 ? "Out of stock" : "Add to cart"}
        </button>
        <button
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="grid h-11 w-11 place-items-center rounded-md border hover:border-ink"
        >
          <Heart className={`h-5 w-5 ${wished ? "fill-sale text-sale" : ""}`} />
        </button>
      </div>

      <ul className="grid gap-3 rounded-lg bg-surface p-4 text-sm sm:grid-cols-2">
        <li className="flex items-center gap-2"><Truck className="h-5 w-5 text-brand-700" /> Free shipping over $99</li>
        <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-700" /> 3-year warranty</li>
      </ul>
    </div>
  );
}

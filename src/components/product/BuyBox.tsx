"use client";

import { CreditCard, Heart, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { Qty } from "@/components/CartDrawer";
import DeliveryPromise from "@/components/DeliveryPromise";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { FREE_SHIPPING, toCents } from "@/lib/pricing";
import { FINANCING, monthlyPaymentCents } from "@/lib/shopping";
import type { Product } from "@/lib/types";

export default function BuyBox({ product }: { product: Product }) {
  const { addToCart, toggleWish, inWishlist, sellerOf } = useShop();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const v = product.variants.find((x) => x.id === variantId)!;
  const sale = v.compareAtPrice && v.compareAtPrice > v.price;
  const wished = inWishlist(product.id);
  const seller = sellerOf(product);
  const monthly = monthlyPaymentCents(toCents(v.price));

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

      {monthly !== null && (
        <p className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm">
          <CreditCard className="mr-1.5 inline h-4 w-4 text-brand-700" />
          As low as <b>{money(monthly / 100)}/mo</b> over {FINANCING.months} months with approved credit.{" "}
          <span className="text-muted">Rates and terms are set by the lender at checkout.</span>
        </p>
      )}

      <div className="space-y-2 rounded-lg border p-4">
        <p className={`text-sm font-semibold ${product.stock <= 0 ? "text-sale" : product.stock < 10 ? "text-orange-600" : "text-emerald-700"}`}>
          {product.stock <= 0
            ? "Out of stock"
            : product.stock < 10
              ? `Only ${product.stock} left in stock`
              : seller && seller.handlingDays > 0
                ? `In stock, ships in ${seller.handlingDays} business day${seller.handlingDays === 1 ? "" : "s"}`
                : "In stock, ships today"}
        </p>
        <DeliveryPromise seller={seller} inStock={product.stock > 0} />
      </div>

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
        <li className="flex items-center gap-2"><Truck className="h-5 w-5 shrink-0 text-brand-700" /> Free shipping over ${FREE_SHIPPING}</li>
        <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" /> Secure checkout with Stripe</li>
      </ul>
    </div>
  );
}

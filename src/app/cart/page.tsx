"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { Qty } from "@/components/CartDrawer";
import ToolArt from "@/components/ToolArt";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { BUNDLES, FREE_SHIPPING_CENTS, quote, toCents } from "@/lib/pricing";

export default function CartPage() {
  const { lines, subtotal, setQty, sellerOf } = useShop();
  const q = quote(lines.map((l) => ({ unitCents: toCents(l.price), qty: l.qty, productId: l.productId, variantId: l.variantId })));

  return (
    <div className="container-x py-10">
      <h1 className="font-display text-4xl uppercase">Shopping cart</h1>
      {lines.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link href="/collections/all" className="btn btn-brand mt-5">Continue shopping</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y border-y">
            {lines.map((l) => (
              <li key={`${l.productId}-${l.variantId}`} className="flex gap-5 py-5">
                <Link href={`/products/${l.product.slug}`} className="h-28 w-28 shrink-0 overflow-hidden rounded border">
                  <ToolArt icon={l.product.icon} tint={l.product.tint} image={l.product.image} alt="" />
                </Link>
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/products/${l.product.slug}`} className="font-display text-lg hover:text-brand-600">{l.product.title}</Link>
                  <p className="text-sm text-muted">{l.variantName} · {money(l.price)}</p>
                  <p className="text-xs text-muted">Sold by {sellerOf(l.product)?.name ?? "Torqline"}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <Qty value={l.qty} onChange={(q) => setQty(l.productId, l.variantId, q)} />
                    <span className="font-semibold">{money(l.price * l.qty)}</span>
                  </div>
                </div>
                <button onClick={() => setQty(l.productId, l.variantId, 0)} aria-label={`Remove ${l.product.title}`} className="self-start text-muted hover:text-sale">
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-lg bg-surface p-6">
            <h2 className="font-display text-xl uppercase">Order summary</h2>
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {q.bundles.map((b) => (
              <div key={b.id} className="flex justify-between text-sm text-emerald-700">
                <span>{BUNDLES.find((x) => x.id === b.id)?.title ?? "Bundle"}{b.sets > 1 ? ` × ${b.sets}` : ""}</span>
                <span>-{money(b.cents / 100)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm text-muted">
              <span>Shipping</span><span>{q.subtotalCents - q.bundleCents >= FREE_SHIPPING_CENTS ? "Free" : "Calculated at checkout"}</span>
            </div>
            <Link href="/checkout" className="btn btn-brand w-full">Proceed to checkout</Link>
            <Link href="/collections/all" className="block text-center text-sm underline">Continue shopping</Link>
          </aside>
        </div>
      )}
    </div>
  );
}

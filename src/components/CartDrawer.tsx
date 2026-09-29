"use client";

import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { FREE_SHIPPING } from "@/lib/pricing";
import ToolArt from "./ToolArt";

export default function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, subtotal, setQty } = useShop();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;
  const remaining = Math.max(0, FREE_SHIPPING - subtotal);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-display text-xl uppercase">Your cart</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close cart">
            <X className="h-6 w-6" />
          </button>
        </div>

        {lines.length > 0 && (
          <div className="border-b bg-brand-50 px-5 py-3 text-sm">
            {remaining > 0 ? (
              <>Spend <b>{money(remaining)}</b> more for free shipping.</>
            ) : (
              <>You&apos;ve unlocked <b>free shipping</b>.</>
            )}
            <div className="mt-2 h-1.5 rounded bg-white">
              <div
                className="h-full rounded bg-brand-500 transition-all"
                style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <ShoppingCart className="h-12 w-12 text-slate-300" />
              <p className="text-muted">Your cart is empty.</p>
              <Link href="/collections/all" onClick={() => setDrawerOpen(false)} className="btn btn-brand">
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {lines.map((l) => (
                <li key={`${l.productId}-${l.variantId}`} className="flex gap-4 p-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded border">
                    <ToolArt icon={l.product.icon} tint={l.product.tint} image={l.product.image} alt="" />
                  </div>
                  <div className="flex-1 text-sm">
                    <Link
                      href={`/products/${l.product.slug}`}
                      onClick={() => setDrawerOpen(false)}
                      className="line-clamp-2 font-medium hover:text-brand-600"
                    >
                      {l.product.title}
                    </Link>
                    <p className="text-muted">{l.variantName}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Qty value={l.qty} onChange={(q) => setQty(l.productId, l.variantId, q)} />
                      <span className="font-semibold">{money(l.price * l.qty)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setQty(l.productId, l.variantId, 0)}
                    aria-label={`Remove ${l.product.title}`}
                    className="self-start text-muted hover:text-sale"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-3 border-t p-5">
            <div className="flex justify-between font-display text-lg">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <p className="text-xs text-muted">Taxes and discount codes are calculated at checkout.</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" onClick={() => setDrawerOpen(false)} className="btn btn-outline">
                View cart
              </Link>
              <Link href="/checkout" onClick={() => setDrawerOpen(false)} className="btn btn-brand">
                Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export function Qty({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded border">
      <button className="grid h-8 w-8 place-items-center" onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-sm" aria-live="polite">{value}</span>
      <button className="grid h-8 w-8 place-items-center" onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ClothingArt from "@/components/ClothingArt";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { quote, toCents } from "@/lib/pricing";
import type { Product } from "@/lib/types";

/** "Frequently bought together": tick the items you want and add them in one click. */
export default function BoughtTogether({ product, others }: { product: Product; others: Product[] }) {
  const { addToCart } = useShop();
  const items = [product, ...others];
  const [picked, setPicked] = useState(() => new Set(items.map((p) => p.id)));
  const chosen = items.filter((p) => picked.has(p.id));
  // First option of each; bundle offers that happen to match are applied by the same pricing as checkout.
  const lines = chosen.map((p) => ({ productId: p.id, variantId: p.variants[0].id, unitCents: toCents(p.variants[0].price), qty: 1 }));
  const q = quote(lines);

  return (
    <div className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            {i > 0 && <Plus aria-hidden className="h-5 w-5 text-muted" />}
            <Link href={`/products/${p.slug}`} className={`block h-24 w-24 overflow-hidden rounded-lg border transition ${picked.has(p.id) ? "" : "opacity-40"}`}>
              <ClothingArt icon={p.icon} tint={p.tint} image={p.image} alt={p.title} />
            </Link>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((p, i) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={picked.has(p.id)}
                onChange={() =>
                  setPicked((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  })
                }
                className="mt-0.5 h-4 w-4 accent-brand-700"
              />
              <span className="flex-1">
                {i === 0 ? <b>This item: </b> : null}
                {p.title}
                {p.variants.length > 1 && <span className="text-muted"> ({p.variants[0].name})</span>}
              </span>
              <span className="font-semibold">{money(p.variants[0].price)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p>
          Total for {chosen.length}:{" "}
          <b className="font-display text-xl">{money((q.subtotalCents - q.bundleCents) / 100)}</b>
          {q.bundleCents > 0 && <span className="ml-2 text-sm font-semibold text-sale">Bundle saving {money(q.bundleCents / 100)}</span>}
        </p>
        <button
          disabled={!chosen.length}
          onClick={() => chosen.forEach((p) => addToCart(p.id, p.variants[0].id))}
          className="btn btn-brand"
        >
          Add {chosen.length === items.length ? "all " : ""}{chosen.length} to cart
        </button>
      </div>
    </div>
  );
}

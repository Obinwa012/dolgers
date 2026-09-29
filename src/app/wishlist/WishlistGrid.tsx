"use client";

import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { useShop } from "@/context/ShopProvider";
import type { Brand } from "@/lib/types";

export default function WishlistGrid({ brands }: { brands: Brand[] }) {
  const { products, wishlist } = useShop();
  const list = products.filter((p) => wishlist.includes(p.id));
  return (
    <div className="container-x py-10">
      <h1 className="font-display text-4xl uppercase">Wishlist</h1>
      {list.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted">No saved items yet. Tap the heart on any product to save it.</p>
          <Link href="/collections/all" className="btn btn-brand mt-5">Browse tools</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />)}
        </div>
      )}
    </div>
  );
}

"use client";

import { useShop } from "@/context/ShopProvider";

/** Adds every item of a bundle to the cart; the saving is applied by pricing at checkout. */
export default function AddBundle({ items, className = "" }: { items: { productId: string; variantId: string }[]; className?: string }) {
  const { addToCart } = useShop();
  return (
    <button onClick={() => items.forEach((i) => addToCart(i.productId, i.variantId))} className={`btn btn-brand ${className}`}>
      Add bundle to cart
    </button>
  );
}

"use client";

import { Store, Truck } from "lucide-react";
import { deliveryWindow, shortDate } from "@/lib/shopping";
import type { Seller } from "@/lib/types";

/**
 * "Delivery by Fri, Oct 2" / "Free depot pickup". The date depends on the clock, so a page cached by
 * ISR can be rendered a few minutes before the browser hydrates it; suppressHydrationWarning keeps
 * React from treating a date that rolled over in between as an error.
 */
export default function DeliveryPromise({
  seller,
  inStock,
  compact = false,
}: {
  seller?: Seller;
  inStock: boolean;
  compact?: boolean;
}) {
  if (!inStock) return <p className="text-xs font-medium text-sale">Out of stock</p>;
  const w = deliveryWindow(seller?.handlingDays ?? 0, new Date());
  return (
    <div className={`space-y-0.5 ${compact ? "text-xs" : "text-sm"}`}>
      <p className="flex items-center gap-1.5">
        <Truck className="h-3.5 w-3.5 shrink-0 text-brand-700" />
        <span suppressHydrationWarning>
          {compact ? (
            <>Delivery by <b>{shortDate(w.to)}</b></>
          ) : (
            <>Get it <b>{shortDate(w.from)}</b> – <b>{shortDate(w.to)}</b></>
          )}
        </span>
      </p>
      {seller?.pickup && (
        <p className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 shrink-0 text-brand-700" />
          <span>Free pickup{compact ? "" : " at the Dolgers depot, ready in 2 hours"}</span>
        </p>
      )}
    </div>
  );
}

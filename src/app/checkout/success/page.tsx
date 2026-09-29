"use client";

import { doc, getDoc } from "firebase/firestore";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { db } from "@/lib/firebase";
import type { Order } from "@/lib/types";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<Shell>Loading…</Shell>}>
      <Success />
    </Suspense>
  );
}

/**
 * Stripe redirects here after payment. The order becomes "paid" only when the webhook arrives,
 * which can lag the redirect by a few seconds, so poll briefly while it's still pending.
 */
function Success() {
  const orderId = useSearchParams().get("order");
  const { user, loading } = useAuth();
  const { clearCart } = useShop();
  const [order, setOrder] = useState<Order | null>(null);
  const [failed, setFailed] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    const d = db();
    if (!orderId || !user || !d) return;
    let stop = false;
    let tries = 0;
    const load = async () => {
      try {
        const snap = await getDoc(doc(d, "orders", orderId));
        if (stop) return;
        if (!snap.exists()) return setFailed(true);
        const o = { id: snap.id, ...snap.data() } as Order;
        setOrder(o);
        if (o.status === "paid" && !cleared.current) {
          cleared.current = true;
          clearCart();
        }
        if (o.status === "pending_payment" && ++tries < 15) setTimeout(load, 2000);
      } catch {
        if (!stop) setFailed(true);
      }
    };
    load();
    return () => {
      stop = true;
    };
  }, [orderId, user, clearCart]);

  if (loading) return <Shell>Loading…</Shell>;
  if (!user) return <Shell>Please <Link href={`/login?next=${encodeURIComponent(`/checkout/success?order=${orderId ?? ""}`)}`} className="underline">log in</Link> to see your order.</Shell>;
  if (!orderId || failed) return <Shell>We couldn&apos;t find that order. Check <Link href="/account" className="underline">your account</Link>.</Shell>;
  if (!order) return <Shell>Confirming your payment…</Shell>;

  const ref = `#${order.id!.slice(0, 8).toUpperCase()}`;
  if (order.status === "paid")
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <CircleCheck className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 font-display text-4xl uppercase">Thanks, you&apos;re all set</h1>
        <p className="mt-3 text-muted">
          Order <b>{ref}</b> is paid ({money((order.amountPaidCents ?? order.totalCents) / 100)}). A receipt is on its way to {order.email}.
        </p>
        <Link href="/account" className="btn btn-brand mt-8">View my orders</Link>
      </div>
    );

  if (order.status === "pending_payment")
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <Clock className="mx-auto h-16 w-16 text-brand-600" />
        <h1 className="mt-4 font-display text-3xl uppercase">Payment processing</h1>
        <p className="mt-3 text-muted">
          We&apos;re waiting for confirmation of order <b>{ref}</b>. This page updates automatically, and the order will show
          as paid in <Link href="/account" className="underline">your account</Link> once it clears.
        </p>
      </div>
    );

  return (
    <div className="container-x max-w-xl py-20 text-center">
      <TriangleAlert className="mx-auto h-16 w-16 text-sale" />
      <h1 className="mt-4 font-display text-3xl uppercase">Payment not completed</h1>
      <p className="mt-3 text-muted">Order {ref} wasn&apos;t paid. Your cart is still saved.</p>
      <Link href="/checkout" className="btn btn-brand mt-8">Try again</Link>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-x max-w-xl py-20 text-center text-muted">{children}</div>;
}

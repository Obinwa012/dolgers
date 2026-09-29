"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { LogOut, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { money } from "@/lib/catalog";
import { db } from "@/lib/firebase";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800" },
  placed: { label: "Placed (demo)", cls: "bg-emerald-100 text-emerald-800" },
  pending_payment: { label: "Awaiting payment", cls: "bg-amber-100 text-amber-900" },
  payment_failed: { label: "Payment failed", cls: "bg-red-100 text-red-800" },
  canceled: { label: "Canceled", cls: "bg-slate-200 text-slate-700" },
};

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  // Set while logging out so the "not signed in → login" redirect below doesn't win the race
  // against router.push("/") (it used to land users on /login?next=/account after logging out).
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!loading && !user && !leaving) router.replace("/login?next=/account");
  }, [loading, user, leaving, router]);

  useEffect(() => {
    const d = db();
    if (!user || !d) return;
    getDocs(query(collection(d, "orders"), where("uid", "==", user.uid), orderBy("createdAt", "desc")))
      .then((s) =>
        setOrders(
          s.docs
            .map((x) => ({ id: x.id, ...x.data() }) as Order)
            // Abandoned Stripe sessions expire into "canceled" orders; they're noise for the customer.
            .filter((o) => o.status !== "canceled"),
        ),
      )
      .catch((e) => {
        setOrders([]);
        setError(
          String(e?.message ?? e).includes("index")
            ? "Orders need a Firestore index. Run `firebase deploy --only firestore:indexes`."
            : "Could not load orders.",
        );
      });
  }, [user]);

  if (loading || !user) return <div className="container-x py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase">My account</h1>
          <p className="text-muted">Signed in as {user.displayName ? `${user.displayName} · ` : ""}{user.email}</p>
        </div>
        <button
          onClick={() => {
            setLeaving(true);
            logout().then(() => router.push("/"));
          }}
          className="btn btn-outline"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>

      <h2 className="mt-10 font-display text-2xl uppercase">Order history</h2>
      {error && <p className="mt-3 text-sm text-sale">{error}</p>}
      {orders === null ? (
        <p className="mt-4 text-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-muted">No orders yet.</p>
          <Link href="/collections/all" className="btn btn-brand mt-5">Start shopping</Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-lg border p-5">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">#{o.id!.slice(0, 8).toUpperCase()}</span>
                <span className="text-muted">{new Date(o.createdAt).toLocaleString()}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${(STATUS[o.status] ?? STATUS.placed).cls}`}>
                  {(STATUS[o.status] ?? { label: o.status }).label}
                </span>
                <span className="font-display text-lg">{money(o.total)}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {o.items.map((i) => (
                  <li key={`${i.productId}-${i.variantId}`}>{i.qty} × {i.title} ({i.variantName})</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

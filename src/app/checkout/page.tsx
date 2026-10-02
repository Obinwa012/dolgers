"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import { money } from "@/lib/catalog";
import { BUNDLES, DISCOUNT_CODES, normalizeCode, quote, toCents } from "@/lib/pricing";

/**
 * Checkout. The totals shown here are a preview only: the browser sends product ids, quantities,
 * the code and the address to /api/checkout, which re-prices everything from the catalog and
 * redirects to Stripe Checkout.
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="container-x py-20 text-center text-muted">Loading…</div>}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const { user, loading } = useAuth();
  const { lines, clearCart } = useShop();
  const canceled = useSearchParams().get("canceled") === "1";
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoOrderId, setDemoOrderId] = useState<string | null>(null);

  const q = quote(
    lines.map((l) => ({ unitCents: toCents(l.price), qty: l.qty, productId: l.productId, variantId: l.variantId })),
    applied,
  );

  if (demoOrderId)
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <CircleCheck className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 font-display text-4xl uppercase">Order placed</h1>
        <p className="mt-3 text-muted">
          Order <b>#{demoOrderId.slice(0, 8).toUpperCase()}</b> is saved to your account. (Demo mode: no payment was taken.)
        </p>
        <Link href="/account" className="btn btn-brand mt-8">View my orders</Link>
      </div>
    );

  if (loading) return <div className="container-x py-20 text-center text-muted">Loading…</div>;

  if (!user)
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <h1 className="font-display text-3xl uppercase">Sign in to check out</h1>
        <p className="mt-3 text-muted">Your cart will be saved to your account.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?next=/checkout" className="btn btn-brand">Log in</Link>
          <Link href="/register?next=/checkout" className="btn btn-outline">Create account</Link>
        </div>
      </div>
    );

  if (!lines.length)
    return (
      <div className="container-x py-20 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/collections/all" className="btn btn-brand mt-5">Keep shopping</Link>
      </div>
    );

  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          // `lines` = cart items that still exist in the catalog (what the customer can see).
          items: lines.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
          code: applied,
          address: { name: get("name"), line1: get("line1"), city: get("city"), postcode: get("postcode"), country: get("country") },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; orderId?: string; demo?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Checkout failed. Please try again.");
      if (data.url) {
        // Keep the cart until payment succeeds; /checkout/success clears it.
        window.location.assign(data.url);
        return;
      }
      if (data.demo && data.orderId) {
        clearCart();
        setDemoOrderId(data.orderId);
      }
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="container-x py-10">
      <h1 className="font-display text-4xl uppercase">Checkout</h1>
      {canceled && (
        <p className="mt-4 rounded-lg border border-slate-300 bg-surface p-4 text-sm" role="status">
          Payment canceled. Your cart is still here whenever you&apos;re ready.
        </p>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <form id="checkout" onSubmit={placeOrder} className="space-y-4">
          <h2 className="font-display text-xl uppercase">Shipping address</h2>
          <input name="name" required maxLength={120} placeholder="Full name" defaultValue={user.displayName ?? ""} className="input" autoComplete="name" />
          <input name="line1" required maxLength={200} placeholder="Street address" className="input" autoComplete="address-line1" />
          <div className="grid gap-4 sm:grid-cols-3">
            <input name="city" required maxLength={100} placeholder="City" className="input" autoComplete="address-level2" />
            <input name="postcode" required maxLength={20} placeholder="ZIP / Postcode" className="input" autoComplete="postal-code" />
            <input name="country" required maxLength={60} placeholder="Country" defaultValue="United States" className="input" autoComplete="country-name" />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="h-4 w-4" /> You&apos;ll enter payment details on the next step, on Stripe&apos;s secure checkout.
          </p>
          {error && <p className="text-sm text-sale" role="alert">{error}</p>}
        </form>

        <aside className="h-fit space-y-4 rounded-lg bg-surface p-6">
          <ul className="space-y-3 text-sm">
            {lines.map((l) => (
              <li key={`${l.productId}-${l.variantId}`} className="flex justify-between gap-3">
                <span className="line-clamp-2">{l.qty} × {l.product.title} <span className="text-muted">({l.variantName})</span></span>
                <span>{money(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t pt-4">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="input" aria-label="Discount code" />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                const c = normalizeCode(code);
                if (DISCOUNT_CODES[c]) {
                  setApplied(c);
                  setError("");
                } else setError("That discount code isn't valid.");
              }}
            >
              Apply
            </button>
          </div>
          {applied && DISCOUNT_CODES[applied]?.firstOrderOnly && (
            <p className="text-xs text-muted">{applied} applies to your first order only; we&apos;ll confirm at payment.</p>
          )}
          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(q.subtotalCents / 100)}</dd></div>
            {q.bundles.map((b) => (
              <div key={b.id} className="flex justify-between text-emerald-700">
                <dt>{BUNDLES.find((x) => x.id === b.id)?.title ?? "Bundle"}{b.sets > 1 ? ` × ${b.sets}` : ""}</dt>
                <dd>-{money(b.cents / 100)}</dd>
              </div>
            ))}
            {q.discountCents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount ({applied})</dt><dd>-{money(q.discountCents / 100)}</dd>
              </div>
            )}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{q.shippingCents ? money(q.shippingCents / 100) : "Free"}</dd></div>
            <div className="flex justify-between font-display text-xl"><dt>Total</dt><dd>{money(q.totalCents / 100)}</dd></div>
          </dl>
          <button form="checkout" disabled={busy} className="btn btn-brand w-full">
            {busy ? "Starting secure checkout…" : "Continue to payment"}
          </button>
        </aside>
      </div>
    </div>
  );
}

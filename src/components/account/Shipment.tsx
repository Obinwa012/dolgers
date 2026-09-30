"use client";

import type { User } from "firebase/auth";
import { Truck } from "lucide-react";
import { useState } from "react";
import { useShop } from "@/context/ShopProvider";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
import { RETURN_REASONS, returnDeadline, SELLER_RESPONSE_DAYS } from "@/lib/marketplace";
import type { ReturnRequest, ReturnStatus, SellerOrder } from "@/lib/types";

const RETURN_LABEL: Record<ReturnStatus, string> = {
  requested: "Return requested, waiting on seller",
  approved: "Return approved, refund issued",
  rejected: "Seller declined the return",
  escalated: "Escalated to Dolgers",
  resolved_refund: "Dolgers refunded you",
  resolved_denied: "Dolgers declined the return",
};

const DAY = 86_400_000;

/** One seller's part of an order: status, tracking, returns. */
export default function Shipment({
  user, s, returns, onChange,
}: {
  user: User;
  s: SellerOrder & { id: string };
  returns: (ReturnRequest & { id: string })[];
  onChange: () => void;
}) {
  const { sellers } = useShop();
  const seller = sellers.find((x) => x.slug === s.seller);
  const deadline = returnDeadline(s, seller?.returnDays ?? 30);
  // Fixed at first render; good enough for a "can I still return this?" check.
  const [now] = useState(() => Date.now());
  // Units per line not already covered by a (non-denied) return.
  const returnable = s.items.some(
    (i) => i.qty > returns.filter((r) => r.productId === i.productId && r.variantId === i.variantId && r.status !== "resolved_denied").reduce((n, r) => n + r.qty, 0),
  );
  const canReturn = deadline !== null && now <= deadline && returnable;
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Sold by <b>{seller?.name ?? s.seller}</b></span>
        <span className="flex items-center gap-1.5 text-muted">
          <Truck className="h-4 w-4" />
          {s.status === "shipped" || s.status === "delivered"
            ? <>Shipped{s.carrier ? ` via ${s.carrier}` : ""}{s.trackingNumber ? <>: <b className="text-ink">{s.trackingNumber}</b></> : null}</>
            : s.status === "canceled" ? "Canceled" : "Preparing to ship"}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-muted">
        {s.items.map((i) => <li key={`${i.productId}-${i.variantId}`}>{i.qty} × {i.title} ({i.variantName})</li>)}
      </ul>

      {returns.map((r) => {
        const escalatable = r.status === "rejected" || (r.status === "requested" && now - r.createdAt >= SELLER_RESPONSE_DAYS * DAY);
        return (
          <div key={r.id} className="mt-2 rounded border bg-white p-2">
            <p><b>{RETURN_LABEL[r.status]}</b> · {r.qty} × {r.title} · {money((r.refundedCents ?? r.amountCents) / 100)}</p>
            {r.sellerNote && <p className="text-muted">Seller: {r.sellerNote}</p>}
            {r.adminNote && <p className="text-muted">Dolgers: {r.adminNote}</p>}
            {escalatable && (
              <button
                className="mt-1 text-sm font-semibold text-brand-700 underline"
                onClick={() => api(user, "/api/returns", { action: "escalate", returnId: r.id }).then(onChange, (e) => alert(e.message))}
              >
                Ask Dolgers to step in
              </button>
            )}
          </div>
        );
      })}

      {canReturn && s.status !== "canceled" && (
        open ? <ReturnForm user={user} s={s} onDone={() => { setOpen(false); onChange(); }} />
          : (
            <button onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-brand-700 underline">
              Return an item{seller ? ` (handled by ${seller.returns === "dolgers" ? "Dolgers" : seller.name})` : ""}
            </button>
          )
      )}
    </div>
  );
}

function ReturnForm({ user, s, onDone }: { user: User; s: SellerOrder & { id: string }; onDone: () => void }) {
  const [line, setLine] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const item = s.items[line];
  return (
    <form
      className="mt-2 grid gap-2 rounded border bg-white p-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api(user, "/api/returns", {
            action: "request",
            sellerOrderId: s.id,
            productId: item.productId,
            variantId: item.variantId,
            qty: Number(f.get("qty")),
            reason: f.get("reason"),
            details: f.get("details"),
          });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs text-muted sm:col-span-2">Item
        <select value={line} onChange={(e) => setLine(Number(e.target.value))} className="input mt-1 py-1.5!">
          {s.items.map((i, k) => <option key={k} value={k}>{i.title} ({i.variantName})</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">Quantity
        <input name="qty" type="number" min={1} max={item.qty} defaultValue={1} key={line} className="input mt-1 py-1.5!" />
      </label>
      <label className="text-xs text-muted">Reason
        <select name="reason" required defaultValue="" className="input mt-1 py-1.5!">
          <option value="" disabled>Choose…</option>
          {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted sm:col-span-2">Details (optional)
        <textarea name="details" maxLength={1000} rows={2} className="input mt-1" />
      </label>
      {error && <p className="text-sale sm:col-span-2" role="alert">{error}</p>}
      <div className="sm:col-span-2"><button disabled={busy} className="btn btn-brand py-2!">{busy ? "Sending…" : "Request return"}</button></div>
    </form>
  );
}

"use client";

import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
import { COMMISSION_RATE, refundsOn } from "@/lib/marketplace";
import type { ReturnRequest, SellerApplication } from "@/lib/types";

interface AdminData {
  applications: SellerApplication[];
  returns: (ReturnRequest & { id: string })[];
  flagged: { id: string; total: number; status: string; needsReview: string; createdAt: number }[];
}

/** Dolgers staff console: seller approvals, return cases, orders flagged by the webhook. */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    api<AdminData>(user, "/api/admin").then(setData, (e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/admin");
  }, [loading, user, router]);
  useEffect(load, [load]);

  if (error) return <div className="container-x py-20 text-center text-sale">{error}</div>;
  if (!user || !data) return <div className="container-x py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-x space-y-12 py-10">
      <h1 className="font-display text-4xl uppercase">Marketplace admin</h1>

      <section>
        <h2 className="mb-4 font-display text-2xl uppercase">Seller applications ({data.applications.length})</h2>
        {data.applications.length === 0 ? <p className="text-muted">Nothing waiting.</p> : (
          <ul className="space-y-4">{data.applications.map((a) => <Application key={a.uid} user={user} a={a} onDone={load} />)}</ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl uppercase">Returns needing attention ({data.returns.length})</h2>
        <p className="mb-4 text-sm text-muted">Escalated cases, requests sellers haven&apos;t answered, rejections the customer may dispute, and approved refunds that failed to go through.</p>
        {data.returns.length === 0 ? <p className="text-muted">Nothing open.</p> : (
          <ul className="space-y-4">{data.returns.map((r) => <ReturnCase key={r.id} user={user} r={r} onDone={load} />)}</ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl uppercase">Orders flagged for review ({data.flagged.length})</h2>
        {data.flagged.length === 0 ? <p className="text-muted">None.</p> : (
          <ul className="divide-y rounded-lg border text-sm">
            {data.flagged.map((o) => (
              <li key={o.id} className="flex flex-wrap gap-x-4 gap-y-1 p-4">
                <b>#{o.id.slice(0, 8).toUpperCase()}</b><span>{o.status}</span><span>{money(o.total)}</span>
                <span className="text-muted">{new Date(o.createdAt).toLocaleString()}</span>
                <span className="w-full text-sale">{o.needsReview}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Application({ user, a, onDone }: { user: User; a: SellerApplication; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [rate, setRate] = useState(String(COMMISSION_RATE * 100));
  const [error, setError] = useState("");
  const act = async (action: "approve" | "reject") => {
    setError("");
    try {
      await api(user, "/api/admin", { action, uid: a.uid, note, commissionRate: Number(rate) / 100 });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <li className="rounded-lg border p-5 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <b className="font-display text-lg">{a.businessName}</b>
        <span className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="text-muted">{a.legalName} · {a.businessType.replace("_", " ")} · {a.country} · {a.phone} · {a.email}</p>
      {a.website && <p><a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-700 underline">{a.website}</a></p>}
      <p className="mt-2">{a.description}</p>
      <p className="mt-1 text-muted">Categories: {a.categories.join(", ")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <label className="flex items-center gap-1 text-muted">Commission <input type="number" min={0} max={50} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} className="input w-20! py-1.5!" />%</label>
        <button onClick={() => act("approve")} className="btn btn-brand py-2!">Approve</button>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required to reject)" className="input max-w-xs flex-1 py-1.5!" />
        <button onClick={() => act("reject")} className="btn btn-outline py-2!">Reject</button>
      </div>
      {error && <p className="mt-2 text-sale" role="alert">{error}</p>}
    </li>
  );
}

function ReturnCase({ user, r, onDone }: { user: User; r: ReturnRequest & { id: string }; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const stuck = refundsOn(r.status) && !r.refundId;
  const act = async (body: Record<string, unknown>) => {
    setError("");
    try {
      await api(user, "/api/admin", { returnId: r.id, note, ...body });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <li className="rounded-lg border p-5 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <b>{r.qty} × {r.title} · {money(r.amountCents / 100)}</b>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${r.status === "escalated" || stuck ? "bg-sale text-white" : "bg-surface"}`}>
          {stuck ? "refund failed" : r.status.replace("_", " ")}
        </span>
      </div>
      <p className="text-muted">Seller: {r.seller} · order {r.orderId.slice(0, 8).toUpperCase()} · opened {new Date(r.createdAt).toLocaleDateString()}</p>
      <p className="mt-2"><b>{r.reason}</b>{r.details ? `: ${r.details}` : ""}</p>
      {r.sellerNote && <p className="mt-1 text-muted">Seller said: {r.sellerNote}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {stuck ? (
          <button onClick={() => act({ action: "retryRefund" })} className="btn btn-brand py-2!">Retry refund</button>
        ) : (
          <>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (shown to both sides)" className="input max-w-md flex-1 py-1.5!" />
            <button onClick={() => act({ action: "resolveReturn", decision: "refund" })} className="btn btn-brand py-2!">Refund customer</button>
            <button onClick={() => act({ action: "resolveReturn", decision: "deny" })} className="btn btn-outline py-2!">Deny</button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sale" role="alert">{error}</p>}
    </li>
  );
}

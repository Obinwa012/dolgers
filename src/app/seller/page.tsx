"use client";

import type { User } from "firebase/auth";
import { AlertTriangle, Banknote, CircleCheck, ExternalLink, MessageCircleQuestion, Package, RotateCcw, Store } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Listings from "@/components/seller/Listings";
import { useAuth } from "@/context/AuthProvider";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
import { CARRIERS, COMMISSION_RATE } from "@/lib/marketplace";
import type {
  Brand, Category, PayoutStatus, Product, Question, ReturnRequest, Seller, SellerApplication, SellerOrder,
} from "@/lib/types";

interface Dashboard {
  application: SellerApplication | null;
  seller: Seller | null;
  account?: { connected: boolean; payoutsEnabled: boolean; commissionRate: number | null };
  stripeConfigured?: boolean;
  catalogSeeded?: boolean;
  categories: Category[];
  brands?: Brand[];
  products?: Product[];
  orders?: (SellerOrder & { id: string })[];
  returns?: (ReturnRequest & { id: string })[];
  questions?: (Question & { id: string })[];
}

const TABS = ["overview", "listings", "orders", "returns", "questions"] as const;
type Tab = (typeof TABS)[number];

const PAYOUT: Record<PayoutStatus, { label: string; cls: string }> = {
  held: { label: "Paid on shipment", cls: "bg-slate-100 text-slate-700" },
  pending_onboarding: { label: "Waiting on Stripe setup", cls: "bg-amber-100 text-amber-900" },
  transferred: { label: "Paid out", cls: "bg-emerald-100 text-emerald-800" },
  not_configured: { label: "Payouts off (demo)", cls: "bg-slate-100 text-slate-700" },
  none: { label: "First party", cls: "bg-slate-100 text-slate-700" },
};

const cents = (n: number) => money(n / 100);
const shortId = (id: string) => id.split("_")[0].slice(0, 8).toUpperCase();

export default function SellerDashboardPage() {
  return (
    <Suspense fallback={<div className="container-x py-20 text-center text-muted">Loading…</div>}>
      <SellerDashboard />
    </Suspense>
  );
}

function SellerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    api<Dashboard>(user, "/api/seller").then(setData, (e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/seller");
  }, [loading, user, router]);
  useEffect(load, [load]);

  if (loading || !user || (!data && !error)) return <div className="container-x py-20 text-center text-muted">Loading…</div>;
  if (error && !data) return <div className="container-x py-20 text-center text-sale">{error}</div>;
  if (!data!.seller)
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <Store className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 font-display text-3xl uppercase">No seller account yet</h1>
        <p className="mt-2 text-muted">
          {data!.application?.status === "pending" ? "Your application is being reviewed." : "Apply to start selling on Torqline."}
        </p>
        <Link href="/sell/apply" className="btn btn-brand mt-6">{data!.application ? "View application" : "Apply to sell"}</Link>
      </div>
    );

  const d = data as Required<Dashboard> & { seller: Seller };
  const counts: Record<Tab, number | null> = {
    overview: null,
    listings: null, // badges are for things that need action
    orders: d.orders.filter((o) => o.status === "awaiting_shipment").length,
    returns: d.returns.filter((r) => r.status === "requested").length,
    questions: d.questions.length,
  };

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm uppercase tracking-widest text-muted">Seller dashboard</p>
          <h1 className="font-display text-4xl uppercase">{d.seller.name}</h1>
        </div>
        <Link href={`/sellers/${d.seller.slug}`} className="btn btn-outline"><ExternalLink className="h-4 w-4" /> View storefront</Link>
      </div>

      <nav className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/seller?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-display text-sm uppercase ${tab === t ? "border-brand-700 text-brand-700" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t}
            {counts[t] ? <span className="rounded-full bg-sale px-1.5 text-[11px] leading-5 text-white">{counts[t]}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <Overview user={user} d={d} connectParam={params.get("connect")} />}
        {tab === "listings" && (
          <Listings user={user} products={d.products} categories={d.categories} brands={d.brands} canCreate={d.catalogSeeded} onChange={load} />
        )}
        {tab === "orders" && <Orders user={user} orders={d.orders} onChange={load} />}
        {tab === "returns" && <Returns user={user} returns={d.returns} onChange={load} />}
        {tab === "questions" && <Questions user={user} questions={d.questions} products={d.products} onChange={load} />}
      </div>
    </div>
  );
}

function Overview({ user, d, connectParam }: { user: User; d: Required<Dashboard> & { seller: Seller }; connectParam: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gross = d.orders.reduce((n, o) => n + o.grossCents, 0);
  const paid = d.orders.filter((o) => o.payout === "transferred").reduce((n, o) => n + o.netCents - (o.reversedCents ?? 0), 0);
  const rate = d.account.commissionRate ?? COMMISSION_RATE;

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>(user, "/api/seller", { action: "connect" });
      window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5">
        <h2 className="flex items-center gap-2 font-display text-xl uppercase"><Banknote className="h-5 w-5" /> Payouts</h2>
        {!d.stripeConfigured ? (
          <p className="mt-2 text-sm text-muted">Payouts aren&apos;t switched on for this store yet (no Stripe key). Orders still come through and you can ship them.</p>
        ) : d.account.payoutsEnabled ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><CircleCheck className="h-4 w-4" /> Verified with Stripe. Payouts are sent automatically when you ship.</p>
        ) : (
          <div className="mt-2 space-y-3 text-sm">
            <p className="flex items-start gap-2 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {d.account.connected
                ? "Stripe still needs some details before it can pay you. Payouts for shipped orders are held until then."
                : "Verify your identity, business and bank account with Stripe to receive payouts."}
            </p>
            {connectParam === "done" && <p className="text-muted">Thanks. Stripe can take a few minutes to confirm; reload this page to check.</p>}
            <button onClick={connect} disabled={busy} className="btn btn-brand">{busy ? "Opening Stripe…" : d.account.connected ? "Continue Stripe setup" : "Set up payouts with Stripe"}</button>
            {error && <p className="text-sale" role="alert">{error}</p>}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Commission: {Math.round(rate * 1000) / 10}% of item prices. Store-wide discount codes and shipping are covered by Torqline.</p>
      </section>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Orders to ship", String(d.orders.filter((o) => o.status === "awaiting_shipment").length)],
          ["Open returns", String(d.returns.filter((r) => r.status === "requested").length)],
          ["Gross sales", cents(gross)],
          ["Paid out", cents(paid)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface p-5">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-display text-3xl">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Orders({ user, orders, onChange }: { user: User; orders: (SellerOrder & { id: string })[]; onChange: () => void }) {
  if (!orders.length) return <Empty icon={<Package className="h-10 w-10" />} text="No orders yet." />;
  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id} className="rounded-lg border p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Order #{shortId(o.id)}</span>
            <span className="text-muted">{new Date(o.createdAt).toLocaleString()}</span>
            <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold uppercase">{o.status.replace("_", " ")}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${PAYOUT[o.payout].cls}`}>{PAYOUT[o.payout].label}</span>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <ul className="space-y-1 md:col-span-2">
              {o.items.map((i) => <li key={`${i.productId}-${i.variantId}`}>{i.qty} × {i.title} <span className="text-muted">({i.variantName})</span> · {money(i.price * i.qty)}</li>)}
              <li className="pt-1 text-muted">Gross {cents(o.grossCents)} · commission {cents(o.commissionCents)} · <b className="text-ink">you get {cents(o.netCents - (o.reversedCents ?? 0))}</b>{o.refundedCents ? ` · refunded ${cents(o.refundedCents)}` : ""}</li>
            </ul>
            <address className="not-italic text-muted">
              <b className="text-ink">Ship to</b><br />{o.address.name}<br />{o.address.line1}<br />{o.address.city} {o.address.postcode}<br />{o.address.country}
            </address>
          </div>
          {o.status === "awaiting_shipment" || o.status === "shipped" ? (
            <ShipForm user={user} order={o} onDone={onChange} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ShipForm({ user, order, onDone }: { user: User; order: SellerOrder & { id: string }; onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api(user, "/api/seller", { action: "ship", sellerOrderId: order.id, carrier: f.get("carrier"), trackingNumber: f.get("trackingNumber") });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs text-muted">Carrier
        <select name="carrier" defaultValue={order.carrier ?? "UPS"} className="input mt-1 w-32! py-1.5!">
          {CARRIERS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">Tracking number
        <input name="trackingNumber" required defaultValue={order.trackingNumber ?? ""} className="input mt-1 w-56! py-1.5!" />
      </label>
      <button disabled={busy} className="btn btn-brand py-2!">{order.status === "shipped" ? "Update tracking" : "Mark shipped"}</button>
      {error && <p className="w-full text-sale" role="alert">{error}</p>}
    </form>
  );
}

function Returns({ user, returns, onChange }: { user: User; returns: (ReturnRequest & { id: string })[]; onChange: () => void }) {
  if (!returns.length) return <Empty icon={<RotateCcw className="h-10 w-10" />} text="No return requests." />;
  return (
    <ul className="space-y-4">
      {returns.map((r) => <ReturnRow key={r.id} user={user} r={r} onChange={onChange} />)}
    </ul>
  );
}

function ReturnRow({ user, r, onChange }: { user: User; r: ReturnRequest & { id: string }; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "approve" | "reject") => {
    if (decision === "approve" && !confirm(`Refund ${cents(r.amountCents)} to the customer? The matching share of your payout will be reversed.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(user, "/api/seller", { action: "decideReturn", returnId: r.id, decision, note });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-lg border p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{r.qty} × {r.title}</span>
        <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold uppercase">{r.status.replace("_", " ")}</span>
      </div>
      <p className="mt-1 text-muted">Order #{shortId(r.sellerOrderId)} · {new Date(r.createdAt).toLocaleDateString()} · {cents(r.amountCents)}</p>
      <p className="mt-2"><b>{r.reason}</b>{r.details ? `: ${r.details}` : ""}</p>
      {r.sellerNote && <p className="mt-1 text-muted">Your note: {r.sellerNote}</p>}
      {r.adminNote && <p className="mt-1 text-muted">Torqline: {r.adminNote}</p>}
      {r.status === "requested" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to customer (required to reject)" className="input max-w-md flex-1 py-1.5!" />
          <button disabled={busy} onClick={() => decide("approve")} className="btn btn-brand py-2!">Approve &amp; refund</button>
          <button disabled={busy} onClick={() => decide("reject")} className="btn btn-outline py-2!">Reject</button>
          {error && <p className="w-full text-sale" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}

function Questions({ user, questions, products, onChange }: { user: User; questions: (Question & { id: string })[]; products: Product[]; onChange: () => void }) {
  if (!questions.length) return <Empty icon={<MessageCircleQuestion className="h-10 w-10" />} text="No unanswered questions." />;
  return (
    <ul className="space-y-4">
      {questions.map((q) => <QuestionRow key={q.id} user={user} q={q} product={products.find((p) => p.id === q.productId)} onChange={onChange} />)}
    </ul>
  );
}

function QuestionRow({ user, q, product, onChange }: { user: User; q: Question & { id: string }; product?: Product; onChange: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <li className="rounded-lg border p-5 text-sm">
      <p className="text-muted">{product ? <Link href={`/products/${product.slug}`} className="hover:underline">{product.title}</Link> : q.productId} · from {q.name}</p>
      <p className="mt-1 font-semibold">{q.question}</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api(user, "/api/seller", { action: "answer", questionId: q.id, answer: text });
            onChange();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} placeholder="Your answer (published on the product page)" className="input flex-1" />
        <button className="btn btn-brand">Publish answer</button>
      </form>
      {error && <p className="mt-2 text-sale" role="alert">{error}</p>}
    </li>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted">
      <div className="flex justify-center text-slate-300">{icon}</div>
      <p className="mt-3">{text}</p>
    </div>
  );
}

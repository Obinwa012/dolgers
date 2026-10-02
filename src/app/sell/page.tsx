import { BadgeCheck, BarChart3, Banknote, PackageCheck, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { COMMISSION_RATE } from "@/lib/marketplace";

export const metadata = { title: "Sell on Dolgers" };

const steps = [
  { icon: Store, title: "Apply", text: "Tell us about your business and what you sell. We review every application by hand." },
  { icon: ShieldCheck, title: "Verify", text: "Once approved, confirm your identity, business details and bank account with Stripe, our payments partner." },
  { icon: PackageCheck, title: "List & ship", text: "Add products, keep prices and stock current, and enter tracking when you ship." },
  { icon: Banknote, title: "Get paid", text: `Payouts go out automatically when you ship, minus a ${Math.round(COMMISSION_RATE * 100)}% commission.` },
];

export default function SellPage() {
  return (
    <div>
      <section className="bg-ink text-white">
        <div className="container-x grid gap-8 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-display uppercase tracking-[0.2em] text-accent">Dolgers Marketplace</p>
            <h1 className="mt-3 font-display text-5xl uppercase leading-none md:text-6xl">Sell to the trades</h1>
            <p className="mt-4 max-w-md text-white/80">
              List your fashion label next to ours. We run the storefront, the checkout and customer payments; you ship and get paid.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sell/apply" className="btn bg-accent px-7 text-ink hover:bg-white">Apply to sell</Link>
              <Link href="/seller" className="btn border border-white/40 px-7 hover:bg-white hover:text-ink">Seller dashboard</Link>
            </div>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["No listing fees", "Pay only when you sell."],
              [`${Math.round(COMMISSION_RATE * 100)}% commission`, "Taken automatically from each payout."],
              ["Payouts by Stripe", "Straight to your bank, on your Stripe schedule."],
              ["Seller ratings", "Great service earns you visibility."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg bg-white/5 p-4">
                <BadgeCheck className="h-5 w-5 text-accent" />
                <p className="mt-2 font-display text-lg uppercase">{t}</p>
                <p className="text-white/70">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-x py-14">
        <h2 className="section-title mb-10">How it works</h2>
        <ol className="grid gap-5 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border p-6">
              <span className="font-display text-sm text-muted">Step {i + 1}</span>
              <s.icon className="mt-2 h-8 w-8 text-brand-700" />
              <h3 className="mt-3 font-display text-xl uppercase">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x pb-16">
        <div className="grid gap-6 rounded-xl bg-surface p-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl uppercase">Your responsibilities</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
              <li>Ship within your stated handling time and enter tracking.</li>
              <li>Respond to return requests within 3 days. If you don&apos;t, the customer can escalate to Dolgers.</li>
              <li>Honour your return window (30 days by default) and the manufacturer&apos;s warranty.</li>
              <li>Answer product questions from shoppers.</li>
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl uppercase"><BarChart3 className="h-6 w-6" /> Disputes &amp; refunds</h2>
            <p className="mt-3 text-sm text-muted">
              If you approve a return, the refund goes back to the customer&apos;s card and the matching share of your payout is
              reversed. Dolgers decides escalated cases and card chargebacks, and may reverse payouts for those too.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

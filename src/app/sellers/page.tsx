import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import Stars from "@/components/Stars";
import { getProducts, getSellers } from "@/lib/catalog";
import { SELF_SELLER, sellerOf } from "@/lib/marketplace";

export const metadata = { title: "Sellers" };
export const revalidate = 300;

export default async function SellersPage() {
  const [sellers, products] = await Promise.all([getSellers(), getProducts()]);
  const count = (slug: string) => products.filter((p) => sellerOf(p) === slug).length;
  const ordered = [...sellers].sort((a, b) => Number(b.slug === SELF_SELLER) - Number(a.slug === SELF_SELLER) || b.rating - a.rating);

  return (
    <div className="container-x py-10">
      <h1 className="section-title">Torqline Marketplace</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
        Torqline stock plus vetted specialist sellers. Every seller is identity- and business-verified before they can list,
        and every order is paid through Torqline.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ordered.map((s) => (
          <Link key={s.slug} href={`/sellers/${s.slug}`} className="flex flex-col rounded-xl border p-5 hover:border-ink">
            <span className="grid h-14 w-14 place-items-center rounded-full font-display text-xl text-white" style={{ background: s.color }}>
              {s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <span className="mt-3 flex items-center gap-1 font-display text-xl">
              {s.name} {s.slug === SELF_SELLER && <BadgeCheck className="h-5 w-5 text-brand-600" aria-label="First party" />}
            </span>
            <span className="text-sm text-muted">{s.tagline}</span>
            <span className="mt-2"><Stars rating={s.rating} count={s.ratingCount} /></span>
            <span className="mt-auto pt-4 text-sm font-semibold text-brand-700">{count(s.slug)} products →</span>
          </Link>
        ))}
      </div>
      <div className="mt-12 rounded-xl bg-brand-700 p-8 text-center text-white">
        <h2 className="font-display text-3xl uppercase">Sell on Torqline</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/80">List your stock in front of trades and serious DIYers. We handle checkout and pay you out automatically.</p>
        <Link href="/sell" className="btn btn-light mt-5">Learn more</Link>
      </div>
    </div>
  );
}

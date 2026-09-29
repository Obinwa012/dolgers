import { BadgeCheck, CalendarDays, MapPin, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import Stars from "@/components/Stars";
import { getBrands, getCategories, getProducts, getSellers } from "@/lib/catalog";
import { SELF_SELLER, sellerOf } from "@/lib/marketplace";
import { policyLines } from "@/lib/shopping";

export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/sellers/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = (await getSellers()).find((x) => x.slug === slug);
  return { title: s ? `${s.name} storefront` : "Seller" };
}

/** A seller's storefront: profile, policies and everything they list, filterable by category. */
export default async function SellerPage(props: PageProps<"/sellers/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const catFilter = typeof sp.category === "string" ? sp.category : "";
  const [sellers, products, categories, brands] = await Promise.all([getSellers(), getProducts(), getCategories(), getBrands()]);
  const seller = sellers.find((s) => s.slug === slug);
  if (!seller) notFound();

  const mine = products.filter((p) => sellerOf(p) === seller.slug);
  const cats = categories.filter((c) => mine.some((p) => p.category === c.slug));
  const shown = catFilter ? mine.filter((p) => p.category === catFilter) : mine;
  const policy = policyLines(seller);
  const self = seller.slug === SELF_SELLER;

  return (
    <div>
      <section className="text-white" style={{ background: `linear-gradient(120deg, ${seller.color}, #111418)` }}>
        <div className="container-x flex flex-col gap-6 py-10 md:flex-row md:items-center">
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white/30 bg-white/10 font-display text-4xl">
            {seller.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="flex-1">
            <p className="font-display text-sm uppercase tracking-[0.2em] text-white/70">{self ? "First-party store" : "Marketplace seller"}</p>
            <h1 className="flex items-center gap-2 font-display text-4xl uppercase md:text-5xl">
              {seller.name} {self && <BadgeCheck className="h-8 w-8 text-accent" aria-label="First party" />}
            </h1>
            <p className="mt-1 text-white/85">{seller.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85 [&_.text-muted]:text-white/80">
              <Stars rating={seller.rating} count={seller.ratingCount} size="md" />
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {seller.location}</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> On Torqline since {new Date(seller.since).getUTCFullYear()}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5 text-sm">
          <div className="rounded-lg bg-surface p-5">
            <h2 className="font-display text-lg uppercase">About</h2>
            <p className="mt-2 text-muted">{seller.about}</p>
          </div>
          <ul className="space-y-3 rounded-lg border p-5">
            <li className="flex gap-2"><Truck className="h-5 w-5 shrink-0 text-brand-700" /> {seller.handlingDays === 0 ? "Ships same day before 2pm CT" : `Ships within ${seller.handlingDays} business day${seller.handlingDays === 1 ? "" : "s"}`}</li>
            <li className="flex gap-2"><RotateCcw className="h-5 w-5 shrink-0 text-brand-700" /> {policy.returns}</li>
            <li className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" /> {policy.warranty}</li>
          </ul>
          {cats.length > 1 && (
            <div>
              <h2 className="mb-2 font-display text-lg uppercase">Categories</h2>
              <ul className="space-y-1.5">
                <li><Link href={`/sellers/${seller.slug}`} className={!catFilter ? "font-semibold text-brand-700" : "hover:text-brand-600"}>All ({mine.length})</Link></li>
                {cats.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/sellers/${seller.slug}?category=${c.slug}`} className={catFilter === c.slug ? "font-semibold text-brand-700" : "hover:text-brand-600"}>
                      {c.name} ({mine.filter((p) => p.category === c.slug).length})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
        <div>
          <p className="mb-4 text-sm text-muted">{shown.length} product{shown.length === 1 ? "" : "s"}</p>
          {shown.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {shown.map((p) => <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />)}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted">No listings yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

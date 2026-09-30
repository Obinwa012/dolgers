import { ArrowRight, BatteryCharging, Check, Drill } from "lucide-react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ToolArt, { ICONS } from "@/components/ToolArt";
import DealCountdown from "@/components/home/DealCountdown";
import Finder from "@/components/home/Finder";
import HeroCarousel, { type HeroSlide } from "@/components/home/HeroCarousel";
import ShopTabs, { type TabKey } from "@/components/home/ShopTabs";
import { getBrands, getCategories, getPosts, getProducts, getSellers, money, onSale } from "@/lib/catalog";
import type { IconKey, Product } from "@/lib/types";

export const revalidate = 300;

const TRUST = [
  "All orders ship from US warehouses",
  "Free shipping over $99",
  "30-day hassle-free returns",
  "US-based support, 7 days a week",
];

/** Section header: uppercase title (last word amber), link right, 3px rule. */
function SectionHead({
  title,
  accent,
  href,
  linkLabel,
  right,
}: {
  title: string;
  accent: string;
  href?: string;
  linkLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-[22px] flex items-end justify-between border-b-[3px] border-[#f0f0f2] pb-3">
      <h2 className="font-display text-2xl font-black uppercase tracking-wide text-ink">
        {title} <span className="text-accent">{accent}</span>
      </h2>
      {right ??
        (href && (
          <Link
            href={href}
            className="text-xs font-bold uppercase tracking-wider text-muted hover:text-accent"
          >
            {linkLabel} →
          </Link>
        ))}
    </div>
  );
}

export default async function Home() {
  const [products, categories, brands, posts, sellers] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
    getPosts(),
    getSellers(),
  ]);
  const brandOf = (slug: string) => brands.find((b) => b.slug === slug);

  const withTag = (tag: string) => products.filter((p) => p.tags.includes(tag));
  const popular = [...withTag("hot"), ...products.filter((p) => !p.tags.includes("hot")).sort((a, b) => b.reviewCount - a.reviewCount)].slice(0, 8);
  const tabProducts: Record<TabKey, Product[]> = {
    popular: popular.slice(0, 4),
    featured: withTag("featured").slice(0, 4),
    recent: withTag("new").slice(0, 4),
  };
  const deals = products
    .filter((p) => onSale(p) && p.stock > 0)
    .sort((a, b) => maxPercentOff(b) - maxPercentOff(a))
    .slice(0, 4);
  const slides = heroSlides(products, sellers.length);

  const drillCat = categories.find((c) => c.slug === "power-tools");
  const sawMin = minFrom(products, "power-tools", "saw");
  const powerMin = minFrom(products, "power-tools");

  return (
    <>
      {/* Trust bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="container-x flex flex-wrap items-center justify-center gap-x-11 gap-y-2 py-2.5">
          {TRUST.map((t) => (
            <p key={t} className="flex items-center gap-2 text-xs font-bold text-muted">
              <Check className="h-4 w-4 text-accent" strokeWidth={3} /> {t}
            </p>
          ))}
        </div>
      </div>

      <HeroCarousel slides={slides} />
      <Finder categories={categories} brands={brands} />

      {/* Featured categories */}
      <section className="pb-2 pt-[46px]">
        <div className="container-x">
          <SectionHead title="Featured" accent="Categories" href="/collections/all" linkLabel="View All" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.map((c) => {
              const n = products.filter((p) => p.category === c.slug).length;
              return (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  className="group relative block overflow-hidden rounded"
                >
                  <span className="block aspect-[16/10] overflow-hidden bg-ink">
                    <img
                      src={`/images/categories/${c.slug}.jpg`}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                    <span>
                      <span className="block font-display text-lg font-extrabold uppercase leading-tight text-white">{c.name}</span>
                      <span className="text-xs font-medium text-white/70">{n} product{n === 1 ? "" : "s"}</span>
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition group-hover:bg-accent">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Brand banners */}
      <section className="pb-2 pt-[46px]">
        <div className="container-x grid gap-4 md:grid-cols-2">
          <Link
            href="/brands/voltra"
            className="group relative flex min-h-[190px] items-center overflow-hidden rounded bg-[linear-gradient(100deg,#101012_55%,#2b2b30_100%)] p-[30px] text-white"
          >
            <Drill aria-hidden className="absolute right-6 top-1/2 h-[110px] w-[110px] -translate-y-1/2 text-white/15" strokeWidth={1} />
            <span className="relative">
              <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[2px] text-accent">Brand Spotlight</span>
              <span className="mb-2.5 block font-display text-[28px] font-black uppercase leading-tight">Voltra<br />Brushless Line</span>
              <span className="border-b-2 border-accent pb-0.5 text-xs font-extrabold uppercase tracking-wider">Discover the brand</span>
            </span>
          </Link>
          <Link
            href="/collections/all?tag=new"
            className="group relative flex min-h-[190px] items-center overflow-hidden rounded bg-[linear-gradient(100deg,#3a2404_0%,#6b430a_60%,#8a5a10_100%)] p-[30px] text-white"
          >
            <HammerIcon className="absolute right-6 top-1/2 h-[110px] w-[110px] -translate-y-1/2 text-white/15" />
            <span className="relative">
              <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[2px] text-accent">New Arrivals</span>
              <span className="mb-2.5 block font-display text-[28px] font-black uppercase leading-tight">Ironhide<br />Forged Series</span>
              <span className="border-b-2 border-accent pb-0.5 text-xs font-extrabold uppercase tracking-wider">Shop new tools</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Tabbed product grid */}
      <section className="pb-2 pt-[46px]">
        <div className="container-x">
          <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-[#f0f0f2] pb-3">
            <h2 className="font-display text-2xl font-black uppercase tracking-wide text-ink">
              Shop <span className="text-accent">Tools</span>
            </h2>
          </div>
          <ShopTabs products={tabProducts} brands={brands} />
        </div>
      </section>

      {/* Battery platform band */}
      <section className="pt-[46px]">
        <div className="container-x">
          <div className="flex flex-col gap-5 rounded border-2 border-accent bg-[#fffdf8] p-6 sm:p-8 md:flex-row md:items-center md:gap-6">
            <BatteryCharging className="h-16 w-16 shrink-0 text-accent" strokeWidth={1.4} />
            <div>
              <h3 className="font-display text-[22px] font-black uppercase text-ink">
                One Battery. <span className="text-accent">Every Tool.</span>
              </h3>
              <p className="mt-1 text-[13px] text-muted">
                Shop the 20V MAX platform — every bare tool runs on the same battery. Build your kit once.
              </p>
            </div>
            <Link
              href={drillCat ? `/collections/${drillCat.slug}?q=battery` : "/collections/all?q=battery"}
              className="rounded bg-accent px-7 py-3.5 text-center font-display text-[13px] font-extrabold uppercase tracking-wider text-white hover:bg-[#c97a00] md:ml-auto md:shrink-0"
            >
              Shop the Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Promo band */}
      <section className="pt-[46px]">
        <div className="container-x">
          <div className="relative flex flex-col gap-5 overflow-hidden rounded bg-[linear-gradient(100deg,#e08a00_0%,#f5b301_100%)] p-8 sm:p-9 md:flex-row md:items-center md:gap-7">
            <Drill aria-hidden className="hidden h-[90px] w-[90px] shrink-0 text-ink/25 md:block" strokeWidth={1} />
            <div>
              <span className="inline-block rounded bg-ink px-4 py-2 font-display text-[13px] font-black uppercase tracking-wider text-white">
                Limited Time
              </span>
              <h3 className="mt-2 font-display text-[26px] font-black uppercase text-ink">Get $10 Off Your First Order</h3>
              <p className="text-[13px] font-semibold text-[#4a3405]">Sign up for Dolgers Pro alerts. No spam — just deals worth opening.</p>
            </div>
            <Link
              href="/register"
              className="rounded bg-ink px-9 py-3.5 text-center font-display text-sm font-extrabold uppercase tracking-wider text-white hover:bg-black md:ml-auto md:shrink-0"
            >
              Claim Offer
            </Link>
          </div>
        </div>
      </section>

      {/* Popular brands */}
      <section className="pb-2 pt-[46px]">
        <div className="container-x">
          <SectionHead title="Popular" accent="Brands" href="/brands" linkLabel="All Brands" />
          <div className="grid grid-cols-3 gap-3.5 lg:grid-cols-6">
            {brands.slice(0, 6).map((b) => (
              <Link
                key={b.slug}
                href={`/brands/${b.slug}`}
                className="grid h-[88px] place-items-center rounded border border-slate-200 bg-white px-2 text-center font-display text-lg font-black uppercase tracking-[2px] text-[#a9a9ae] transition hover:border-accent hover:text-ink"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Deals of the week */}
      <section className="mt-[46px] border-y border-slate-200 bg-surface py-[46px]">
        <div className="container-x">
          <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-black uppercase tracking-wide text-ink">
              Best Deals <span className="text-accent">of the Week</span>
            </h2>
            <DealCountdown />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} brand={brandOf(p.brand)} />
            ))}
          </div>
        </div>
      </section>

      {/* Dual promo tiles */}
      <section className="pt-[46px]">
        <div className="container-x grid gap-4 md:grid-cols-2">
          <Link
            href="/collections/power-tools"
            className="relative flex min-h-[170px] flex-col justify-center overflow-hidden rounded bg-[linear-gradient(100deg,#5c1f1a,#8f2f27)] p-7 text-white md:p-8"
          >
            <span className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[2px] text-[#f5b301]">Hot Deals</span>
            <span className="font-display text-[30px] font-black uppercase">Power Tools</span>
            <span className="mt-1 text-sm font-semibold text-white/85">
              Starting from <b className="text-xl text-[#f5b301]">{powerMin}</b>
            </span>
          </Link>
          <Link
            href="/collections/power-tools?sub=saws"
            className="relative flex min-h-[170px] flex-col justify-center overflow-hidden rounded bg-[linear-gradient(100deg,#1c3f63,#2b5f94)] p-7 text-white md:p-8"
          >
            <span className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[2px] text-[#f5b301]">Megasale</span>
            <span className="font-display text-[30px] font-black uppercase">Electric Saws</span>
            <span className="mt-1 text-sm font-semibold text-white/85">
              Starting from <b className="text-xl text-[#f5b301]">{sawMin}</b>
            </span>
          </Link>
        </div>
      </section>

      {/* From the workshop */}
      <section className="pb-14 pt-[46px]">
        <div className="container-x">
          <SectionHead title="From the" accent="Workshop" href="/blog" linkLabel="All Articles" />
          <div className="grid gap-4 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => {
              const d = new Date(post.date);
              const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <article key={post.slug} className="group overflow-hidden rounded border border-slate-200 bg-white">
                  <div className="relative h-[170px] overflow-hidden bg-ink">
                    <img
                      src={POST_IMAGES[post.slug] ?? "/images/blog/blog-cordless.jpg"}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded bg-accent px-2.5 py-1.5 text-[11px] font-extrabold uppercase text-white">
                      {label}
                    </span>
                  </div>
                  <div className="p-4 pb-5 md:px-[18px]">
                    <h4 className="mb-2 font-display text-base font-extrabold leading-snug text-ink">{post.title}</h4>
                    <p className="mb-2.5 line-clamp-2 text-[13px] text-muted">{post.excerpt}</p>
                    <Link href={`/blog/${post.slug}`} className="border-b-2 border-accent pb-0.5 text-xs font-extrabold uppercase tracking-wider text-ink hover:text-accent">
                      Read More
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

/** Blog header photography, keyed by post slug. */
const POST_IMAGES: Record<string, string> = {
  "choosing-your-first-cordless-platform": "/images/blog/blog-cordless.jpg",
  "workshop-storage-that-actually-works": "/images/blog/blog-storage.jpg",
  "blade-basics-for-cleaner-cuts": "/images/blog/blog-blades.jpg",
};

/** Hammer icon (not in lucide set used elsewhere on this page). */
function HammerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 8l9-5 3 2-9 5z" />
      <path d="M14 3l5 3-2 3-5-3z" />
      <path d="M8.5 10.5L4 21" />
    </svg>
  );
}

function maxPercentOff(p: Product) {
  return Math.max(
    0,
    ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? Math.round((1 - v.price / v.compareAtPrice) * 100) : 0)),
  );
}

function maxSaving(p: Product) {
  return Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice - v.price : 0)));
}

/** Cheapest in-stock price in a category (optionally matching an icon/subcategory keyword). */
function minFrom(products: Product[], category: string, keyword?: string) {
  const inCat = products.filter(
    (p) => p.category === category && p.stock > 0 && (!keyword || p.icon === (keyword as IconKey) || p.subcategory?.includes(keyword)),
  );
  if (inCat.length === 0) return money(0);
  return money(Math.min(...inCat.map((p) => Math.min(...p.variants.map((v) => v.price)))));
}

function heroSlides(products: Product[], sellerCount: number): HeroSlide[] {
  const slides: HeroSlide[] = [];
  const special = products.find((p) => p.slug === "voltra-18v-brushless-4-tool-combo-kit" && p.stock > 0 && onSale(p));
  if (special) {
    const v = special.variants.reduce((a, b) => (maxSaving({ ...special, variants: [b] }) > maxSaving({ ...special, variants: [a] }) ? b : a));
    slides.push({
      id: "special-buy", eyebrow: "Dolgers Fall Tool Event", title: "Huge Savings Up To 70% On Pro Tools",
      text: special.title, callout: money(v.price), calloutNote: `was ${money(v.compareAtPrice!)} · save ${money(v.compareAtPrice! - v.price)}`,
      cta: "Shop Now", href: `/products/${special.slug}`, icon: "drill",
      bg: "radial-gradient(1200px 500px at 80% 20%, #333338 0%, #1b1b1d 55%, #101012 100%)", accent: "#e08a00",
    });
  }
  const combos = products.filter((p) => p.subcategory === "combo-kits");
  const comboSave = Math.max(0, ...combos.map(maxSaving));
  if (comboSave > 0)
    slides.push({
      id: "combo-kits", eyebrow: "Combo kit event", title: `Save up to ${money(comboSave).replace(/\.00$/, "")} on combo kits`,
      text: "Drill, driver and saw bundles with batteries and chargers included. Start a platform for less.",
      cta: "Shop combo kits", href: "/collections/power-tools?sub=combo-kits", icon: "box",
      bg: "radial-gradient(1200px 500px at 80% 20%, #333338 0%, #1b1b1d 55%, #101012 100%)", accent: "#e08a00",
    });
  const clear = products.filter((p) => p.tags.includes("clearance"));
  const clearPct = Math.max(0, ...clear.map(maxPercentOff));
  if (clearPct > 0)
    slides.push({
      id: "clearance", eyebrow: "Clearance", title: `Up to ${clearPct}% off, while it lasts`,
      text: `${clear.length} lines marked down to make room for new stock. Limited quantities.`,
      cta: "Shop clearance", href: "/collections/all?clearance=1", icon: "ruler",
      bg: "radial-gradient(1200px 500px at 80% 20%, #4a0d15 0%, #1b1b1d 60%, #101012 100%)", accent: "#e08a00",
    });
  if (sellerCount > 0)
    slides.push({
      id: "marketplace", eyebrow: "New: Dolgers Marketplace", title: "More sellers. More stock.",
      text: `Shop specialist sellers alongside Dolgers, with ratings on every listing and returns backed by us.`,
      cta: "Meet the sellers", href: "/sellers", icon: "sprout",
      bg: "radial-gradient(1200px 500px at 80% 20%, #333338 0%, #1b1b1d 55%, #101012 100%)", accent: "#e08a00",
    });
  return slides;
}

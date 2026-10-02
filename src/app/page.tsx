import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Truck, Zap } from "lucide-react";
import Link from "next/link";
import ClothingArt, { GarmentIcon } from "@/components/ClothingArt";
import ProductCard from "@/components/ProductCard";
import CategorySidebar from "@/components/home/CategorySidebar";
import DealCountdown from "@/components/home/DealCountdown";
import HeroCarousel, { type HeroSlide } from "@/components/home/HeroCarousel";
import PickedForYou from "@/components/home/PickedForYou";
import UserPanel from "@/components/home/UserPanel";
import { getBrands, getCategories, getPosts, getProducts, minPrice, money, onSale } from "@/lib/catalog";
import { splitPrice } from "@/lib/shopping";
import type { Product } from "@/lib/types";

export const revalidate = 300;

const SERVICES = [
  { Icon: Truck, title: "Free shipping over $99", text: "Fast delivery from US warehouses" },
  { Icon: RotateCcw, title: "30-day returns", text: "Changed your mind? Send it back" },
  { Icon: ShieldCheck, title: "Secure checkout", text: "Payments processed by Stripe" },
  { Icon: Headphones, title: "Style help 7 days a week", text: "Real people, real answers" },
];

/** Floors on the home page: a promo tile on the left, the category's best sellers on the right. */
const FLOORS = [
  { slug: "dresses", bg: "linear-gradient(160deg,#be185d,#ea580c)", line: "Dresses for every day" },
  { slug: "knitwear", bg: "linear-gradient(160deg,#78350f,#b45309)", line: "Knit season is here" },
  { slug: "outerwear", bg: "linear-gradient(160deg,#1e293b,#475569)", line: "The coat edit" },
  { slug: "activewear", bg: "linear-gradient(160deg,#6b21a8,#be185d)", line: "Move in comfort" },
];

const maxPercentOff = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? Math.round((1 - v.price / v.compareAtPrice) * 100) : 0)));

export default async function Home() {
  const [products, categories, brands, posts] = await Promise.all([getProducts(), getCategories(), getBrands(), getPosts()]);

  const bySold = [...products].sort((a, b) => (b.sold ?? b.reviewCount * 38) - (a.sold ?? a.reviewCount * 38));
  const deals = products
    .filter((p) => onSale(p) && p.stock > 0)
    .sort((a, b) => maxPercentOff(b) - maxPercentOff(a))
    .slice(0, 5);
  const cheapest = (cat: string) => {
    const l = products.filter((p) => p.category === cat && p.stock > 0);
    return l.length ? money(Math.min(...l.map(minPrice))).replace(/\.00$/, "") : undefined;
  };
  const maxOff = (cat: string) => Math.max(0, ...products.filter((p) => p.category === cat).map(maxPercentOff));

  const slides: HeroSlide[] = [
    {
      id: "autumn", eyebrow: "The Autumn Edit", title: "New-season dresses", text: "Wrap, slip and tiered styles in this season's colours.",
      callout: cheapest("dresses"), calloutNote: "and up", cta: "Shop dresses", href: "/collections/dresses", icon: "dress",
      bg: "linear-gradient(115deg,#be185d,#ea580c)",
    },
    {
      id: "knit", eyebrow: "Knit season", title: `Cosy knits, up to ${maxOff("knitwear")}% off`, text: "Cashmere-blend crewnecks, chunky cardigans and merino turtlenecks.",
      cta: "Shop knitwear", href: "/collections/knitwear", icon: "knit", bg: "linear-gradient(115deg,#78350f,#b45309)",
    },
    {
      id: "coats", eyebrow: "Outerwear", title: "Trenches, wraps & puffers", text: "Layer up with pieces from independent boutiques.",
      callout: cheapest("outerwear"), calloutNote: "and up", cta: "Shop coats", href: "/collections/outerwear", icon: "coat", bg: "linear-gradient(115deg,#1e293b,#475569)",
    },
    {
      id: "active", eyebrow: "Studio ready", title: "Matching sets from " + (cheapest("activewear") ?? ""), text: "Seamless sets, leggings and bras that move with you.",
      cta: "Shop activewear", href: "/collections/activewear", icon: "active", bg: "linear-gradient(115deg,#6b21a8,#be185d)",
    },
  ];

  return (
    <div className="bg-[#f4f4f4] pb-10 pt-3">
      {/* Hero zone: categories | banner | account */}
      <section className="container-x grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_240px] lg:[&>*]:h-[380px]" aria-label="Featured">
        <CategorySidebar categories={categories} products={bySold} />
        <HeroCarousel slides={slides} />
        <UserPanel className="hidden lg:flex" />
      </section>

      {/* Quick entries */}
      <section className="container-x mt-3" aria-label="Quick links">
        <ul className="grid grid-cols-5 gap-y-4 rounded-xl bg-white px-2 py-4 md:grid-cols-10">
          {[
            ...categories.map((c) => ({ href: `/collections/${c.slug}`, label: c.name.split(" ")[0].replace("&", ""), icon: c.icon, tint: c.tint })),
            { href: "/collections/all?sale=1", label: "Deals", icon: null, tint: "#ff0036" },
            { href: "/collections/all?sort=new", label: "New In", icon: null, tint: "#ff5000" },
          ].map((t) => (
            <li key={t.label}>
              <Link href={t.href} className="group flex flex-col items-center gap-1.5 text-xs text-[#555] hover:text-accent">
                <span className="grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-105" style={{ background: `${t.tint}1a`, color: t.tint }}>
                  {t.icon ? <GarmentIcon icon={t.icon} className="h-7 w-7" /> : t.label === "Deals" ? <Zap className="h-6 w-6" /> : <span className="text-sm font-black">NEW</span>}
                </span>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Flash deals */}
      {deals.length > 0 && (
        <section className="container-x mt-3" aria-labelledby="flash-h">
          <div className="rounded-xl bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <h2 id="flash-h" className="flex items-center gap-1.5 text-xl font-black text-accent">
                <Zap className="h-5 w-5 fill-accent" /> Flash Deals
              </h2>
              <DealCountdown />
              <Link href="/collections/all?sale=1" className="ml-auto flex items-center gap-0.5 text-sm text-[#999] hover:text-accent">
                More <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {deals.map((p) => {
                const price = splitPrice(minPrice(p));
                const claimed = 35 + ((p.sold ?? 0) % 55);
                return (
                  <li key={p.id}>
                    <Link href={`/products/${p.slug}`} className="group block">
                      <span className="relative block aspect-square overflow-hidden rounded-lg bg-surface">
                        <ClothingArt icon={p.icon} tint={p.tint} image={p.image} alt={p.title} className="transition duration-500 group-hover:scale-105" />
                        <span className="absolute left-0 top-2 rounded-r-full bg-sale px-2.5 py-0.5 text-[11px] font-bold text-white">-{maxPercentOff(p)}%</span>
                      </span>
                      <span className="mt-2 block truncate text-[13px] text-ink group-hover:text-accent">{p.title}</span>
                      <span className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-bold text-accent"><span className="text-[13px]">$</span><span className="text-[22px] leading-none">{price.whole}</span><span className="text-[13px]">{price.cents}</span></span>
                        <s className="text-xs text-[#999]">${Math.max(...p.variants.map((v) => v.compareAtPrice ?? 0))}</s>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2" aria-label={`${claimed}% claimed`}>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#ffe1d2]"><span className="block h-full rounded-full bg-gradient-to-r from-accent-bright to-accent" style={{ width: `${claimed}%` }} /></span>
                        <span className="text-[11px] text-[#999]">{claimed}% claimed</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Category floors */}
      {FLOORS.map((f) => {
        const cat = categories.find((c) => c.slug === f.slug);
        const items = bySold.filter((p) => p.category === f.slug).slice(0, 4);
        if (!cat || items.length === 0) return null;
        return (
          <section key={f.slug} className="container-x mt-3" aria-labelledby={`floor-${f.slug}`}>
            <div className="rounded-xl bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                <h2 id={`floor-${f.slug}`} className="text-xl font-black text-ink">
                  <span className="mr-2 inline-block h-4 w-1 rounded bg-accent align-[-1px]" />
                  {cat.name}
                </h2>
                <ul className="hidden gap-4 text-sm text-[#999] md:flex">
                  {(cat.subcategories ?? []).map((s) => (
                    <li key={s.slug}><Link href={`/collections/${cat.slug}?sub=${s.slug}`} className="hover:text-accent">{s.name}</Link></li>
                  ))}
                </ul>
                <Link href={`/collections/${cat.slug}`} className="ml-auto flex items-center gap-0.5 text-sm text-[#999] hover:text-accent">
                  More <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-3 lg:grid-cols-[230px_minmax(0,1fr)]">
                <Link href={`/collections/${cat.slug}`} className="relative flex min-h-[170px] flex-col justify-end overflow-hidden rounded-lg p-5 text-white" style={{ background: f.bg }}>
                  <GarmentIcon icon={cat.icon} className="absolute -right-4 top-4 h-40 w-40 rotate-[10deg] text-white/20" />
                  <span className="relative text-2xl font-black leading-tight">{f.line}</span>
                  <span className="relative mt-1 text-sm font-medium text-white/90">From {cheapest(cat.slug)}</span>
                  <span className="relative mt-3 w-fit rounded-full bg-white px-5 py-1.5 text-sm font-bold text-accent">Shop now</span>
                </Link>
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {items.map((p) => (
                    <li key={p.id}><ProductCard product={p} /></li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}

      {/* Brand street */}
      <section className="container-x mt-3" aria-labelledby="brands-h">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3 flex items-center">
            <h2 id="brands-h" className="text-xl font-black text-ink">
              <span className="mr-2 inline-block h-4 w-1 rounded bg-accent align-[-1px]" />
              Brand Street
            </h2>
            <Link href="/brands" className="ml-auto flex items-center gap-0.5 text-sm text-[#999] hover:text-accent">All brands <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 md:grid-cols-5 lg:grid-cols-9">
            {brands.map((b) => (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}`} className="grid h-16 place-items-center rounded-lg border border-[#f0f0f0] px-2 text-center text-[15px] font-black text-ink transition hover:border-accent hover:text-accent">
                  <span style={{ color: b.color }}>{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feed */}
      <section className="container-x mt-6" aria-labelledby="feed-h">
        <h2 id="feed-h" className="mb-3 flex items-center justify-center gap-3 text-xl font-black text-ink">
          <span className="h-px w-12 bg-[#ddd]" /> Picked for You <span className="h-px w-12 bg-[#ddd]" />
        </h2>
        <PickedForYou products={bySold} categories={categories} />
      </section>

      {/* Style journal */}
      <section className="container-x mt-8" aria-labelledby="journal-h">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3 flex items-center">
            <h2 id="journal-h" className="text-xl font-black text-ink">
              <span className="mr-2 inline-block h-4 w-1 rounded bg-accent align-[-1px]" />
              Style Journal
            </h2>
            <Link href="/blog" className="ml-auto flex items-center gap-0.5 text-sm text-[#999] hover:text-accent">All articles <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex gap-3 rounded-lg border border-[#f0f0f0] p-2.5 transition hover:border-accent">
                <span className="block h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                  <ClothingArt icon={post.icon} tint={post.tint} variant="bold" alt="" className="transition duration-500 group-hover:scale-105" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-bold text-ink group-hover:text-accent">{post.title}</span>
                  <span className="mt-1 line-clamp-2 text-xs text-[#888]">{post.excerpt}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Service promises */}
      <section className="container-x mt-3" aria-label="Our promises">
        <ul className="grid gap-3 rounded-xl bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-accent"><Icon className="h-5 w-5" /></span>
              <span className="leading-tight">
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="text-xs text-[#888]">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

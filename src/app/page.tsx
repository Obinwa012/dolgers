import { BadgePercent, ChevronRight, ShieldCheck, Truck, Zap } from "lucide-react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import FeaturedTabs from "@/components/home/FeaturedTabs";
import Reviews from "@/components/home/Reviews";
import Newsletter from "@/components/Newsletter";
import ProductCard from "@/components/ProductCard";
import Rail from "@/components/Rail";
import ToolArt, { ICONS } from "@/components/ToolArt";
import { reviews } from "@/data/catalog";
import { getBrands, getCategories, getPosts, getProducts } from "@/lib/catalog";
import type { Brand, IconKey } from "@/lib/types";

export const revalidate = 300;

const perks = [
  { icon: Truck, title: "Free Shipping Over $99", text: "Dispatched same day before 2pm." },
  { icon: ShieldCheck, title: "3-Year Tool Warranty", text: "On every powered tool we sell." },
  { icon: Zap, title: "Trade Pricing", text: "Open a free trade account." },
  { icon: BadgePercent, title: "5% Off First Order", text: "Use code FIRSTBUILD at checkout." },
];

type Promo = { title: string; text: string; brand: string; icon: IconKey; bg: string; tint: string; href: string };

const promos: Promo[] = [
  { title: "Free blade pack with any saw", text: "Pick up a spare cutting set when you buy a circular or jigsaw.", brand: "kestrel", icon: "saw", bg: "#10325e", tint: "#f97316", href: "/collections/power-tools" },
  { title: "Dual-battery mowers", text: "Self-propelled cutting from the pro garden range.", brand: "norrmark", icon: "sprout", bg: "#0f3b33", tint: "#22c55e", href: "/collections/lawn-garden" },
  { title: "Bonus battery bundle", text: "Add a free 2.0Ah pack when you buy any combo kit.", brand: "voltra", icon: "battery", bg: "#0e3a5c", tint: "#f97316", href: "/collections/power-supplies" },
  { title: "Combo kit with soft bag", text: "Drill, impact driver and 2 batteries, ready for site.", brand: "ironhide", icon: "drill", bg: "#1f2027", tint: "#facc15", href: "/collections/power-tools" },
  { title: "Compact drill drivers", text: "Palm-sized power for cabinets and fit-outs.", brand: "voltra", icon: "drill", bg: "#0b2e46", tint: "#06b6d4", href: "/products/voltra-vx12-compact-drill-driver" },
  { title: "Brushless grinders", text: "Kickback protection as standard on 18V models.", brand: "norrmark", icon: "flame", bg: "#0e2f22", tint: "#10b981", href: "/collections/welding" },
];

const deals = [
  { big: "Save $40", text: "on selected brushless jigsaws for wood and metal.", bg: "from-sky-700 to-sky-500", icon: "saw" as IconKey, href: "/products/voltra-js18-brushless-jigsaw" },
  { big: "Free bit set", text: "with any drill driver kit, while stocks last.", bg: "from-cyan-700 to-teal-500", icon: "nut" as IconKey, href: "/collections/accessories" },
  { big: "Free storage", text: "stackable case with selected nailers.", bg: "from-red-800 to-red-500", icon: "box" as IconKey, href: "/collections/storage" },
  { big: "Up to 20% off", text: "hand tool sets from our workshop brands.", bg: "from-orange-700 to-amber-500", icon: "wrench" as IconKey, href: "/collections/hand-tools" },
];

export default async function Home() {
  const [products, categories, brands, posts] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
    getPosts(),
  ]);
  const brandOf = (slug: string) => brands.find((b) => b.slug === slug);
  const newArrivals = products.filter((p) => p.tags.includes("new")).slice(0, 10);
  const tabs = categories.filter((c) =>
    ["power-tools", "hand-tools", "storage", "power-supplies", "lawn-garden"].includes(c.slug),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#eef1f3] via-[#e6eaec] to-[#c9d3d8]">
        <div className="container-x grid min-h-[420px] items-center gap-8 py-12 md:min-h-[520px] md:grid-cols-2">
          <div className="relative z-10 max-w-xl">
            <p className="mb-3 font-display uppercase tracking-[0.2em] text-brand-600">Built for the job site</p>
            <h1 className="font-display text-4xl uppercase leading-[1.05] md:text-6xl">
              Serious tools.<br />Straight answers.
            </h1>
            <p className="mt-5 max-w-md text-muted md:text-lg">
              Hand-picked power and hand tools, tested by trades, backed by a 3-year warranty
              and shipped the same day.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/collections/all" className="btn btn-brand px-7">Shop now</Link>
              <Link href="/collections/all?sale=1" className="btn btn-outline px-7">View deals</Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rotate-6 rounded-[2.5rem] bg-accent" />
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
              <ToolArt icon="drill" tint="#0d6b78" variant="bold" alt="Cordless drill illustration" />
            </div>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="border-b bg-white">
        <ul className="container-x grid grid-cols-1 gap-6 py-7 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4 lg:justify-center">
              <Icon className="h-9 w-9 shrink-0 text-brand-700" strokeWidth={1.5} />
              <div>
                <p className="font-display text-lg">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Newsletter strip */}
      <section className="bg-surface">
        <div className="container-x flex flex-col items-center gap-5 py-10 md:flex-row md:justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase md:text-3xl">Want first dibs on deals?</h2>
            <p className="text-muted">Join the list for flash sales, new releases and trade tips.</p>
          </div>
          <div className="w-full md:max-w-lg">
            <Newsletter />
          </div>
        </div>
      </section>

      {/* Promo mosaic */}
      <section className="container-x py-12 md:py-16">
        <div className="grid gap-5 md:grid-cols-[1fr_1.25fr_0.75fr]">
          <div className="grid gap-5">
            <PromoCard p={promos[0]} brand={brandOf(promos[0].brand)} tall />
            <PromoCard p={promos[1]} brand={brandOf(promos[1].brand)} />
          </div>
          <div className="grid gap-5">
            <PromoCard p={promos[2]} brand={brandOf(promos[2].brand)} />
            <PromoCard p={promos[3]} brand={brandOf(promos[3].brand)} tall />
          </div>
          <div className="grid gap-5">
            <PromoCard p={promos[4]} brand={brandOf(promos[4].brand)} tall />
            <PromoCard p={promos[5]} brand={brandOf(promos[5].brand)} />
          </div>
        </div>
      </section>

      {/* Shop by category */}
      <section className="container-x pb-14">
        <h2 className="section-title mb-10">Shop by category</h2>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-9 md:px-0">
          {categories.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="group flex w-24 shrink-0 flex-col items-center gap-3 text-center md:w-auto">
                <span
                  className="grid aspect-square w-full place-items-center rounded-full transition group-hover:scale-105"
                  style={{ background: `${c.tint}15` }}
                >
                  <Icon className="h-1/2 w-1/2" strokeWidth={1.3} style={{ color: c.tint }} />
                </span>
                <span className="text-sm group-hover:text-brand-600">{c.name}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link href="/collections/all" className="btn btn-outline">View all <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Top deals + New arrivals */}
      <section className="bg-surface py-14">
        <div className="container-x">
          <div className="mb-8 inline-flex items-center gap-3 bg-sale py-3 pl-5 pr-14 font-display text-3xl uppercase text-accent [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] md:text-4xl">
            <Zap className="h-8 w-8 fill-accent" /> Top deals
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {deals.map((d) => (
              <Link key={d.big} href={d.href} className={`group relative flex min-h-64 flex-col overflow-hidden rounded-lg bg-gradient-to-br p-7 text-white ${d.bg}`}>
                <p className="font-display text-4xl uppercase">{d.big}</p>
                <p className="mt-2 max-w-[16rem] text-white/90">{d.text}</p>
                <span className="btn btn-light mt-5 w-fit">Shop now</span>
                {(() => {
                  const Icon = ICONS[d.icon];
                  return <Icon className="absolute -bottom-6 -right-6 h-40 w-40 text-white/15 transition group-hover:scale-110" strokeWidth={1} />;
                })()}
              </Link>
            ))}
          </div>

          <h2 className="section-title mb-10 mt-20">New arrivals</h2>
          <Rail label="New arrivals">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} brand={brandOf(p.brand)} />
            ))}
          </Rail>
          <div className="mt-8 text-center">
            <Link href="/collections/all?sort=new" className="btn btn-outline">Shop new <ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Two banners */}
      <section className="container-x grid gap-5 py-12 md:grid-cols-2">
        <Banner title="High-output batteries" text="Longer runtime and more torque from the latest cell tech." href="/collections/power-supplies" bg="from-cyan-800 to-cyan-500" icon="battery" brand={brandOf("brunn")} />
        <Banner title="Welding & metalwork" text="Grinders, welders and PPE for clean, safe fabrication." href="/collections/welding" bg="from-orange-900 to-orange-600" icon="flame" brand={brandOf("voltra")} />
      </section>

      {/* Featured tabs */}
      <section className="bg-surface py-14">
        <div className="container-x">
          <h2 className="section-title mb-6">Featured products</h2>
          <FeaturedTabs tabs={tabs} products={products} brands={brands} />
        </div>
      </section>

      {/* Reviews */}
      <section className="py-14">
        <div className="container-x">
          <h2 className="section-title mb-10">What the trades say</h2>
          <Reviews reviews={reviews} />
        </div>
      </section>

      {/* Brands */}
      <section className="container-x pb-14">
        <h2 className="section-title mb-10">Shop by brand</h2>
        <Rail label="Brands" itemClass="w-[70%] sm:w-[40%] md:w-[30%] lg:w-[22%] xl:w-[calc((100%-6.25rem)/6)]">
          {brands.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <Link key={b.slug} href={`/brands/${b.slug}`} className="relative flex h-36 items-start overflow-hidden rounded-lg p-5" style={{ background: b.color, color: b.textColor }}>
                <span className="font-display text-3xl font-bold">{b.name}</span>
                <Icon className="absolute -bottom-3 right-2 h-28 w-28 opacity-30" strokeWidth={1.2} />
              </Link>
            );
          })}
        </Rail>
      </section>

      {/* Blog */}
      <section className="container-x pb-16">
        <h2 className="section-title mb-10">From the workshop</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {posts.slice(0, 3).map((p) => (
            <article key={p.slug} className="group">
              <Link href={`/blog/${p.slug}`} className="block aspect-[16/10] overflow-hidden rounded-lg">
                <ToolArt icon={p.icon} tint={p.tint} variant="bold" alt="" className="transition duration-500 group-hover:scale-105" />
              </Link>
              <p className="mt-4 text-xs text-muted">
                {new Date(p.date).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })} / {p.author}
              </p>
              <h3 className="mt-2 font-display text-xl uppercase">
                <Link href={`/blog/${p.slug}`} className="hover:text-brand-600">{p.title}</Link>
              </h3>
              <p className="mt-2 text-sm text-muted">{p.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PromoCard({ p, brand, tall = false }: { p: Promo; brand?: Brand; tall?: boolean }) {
  const Icon = ICONS[p.icon];
  return (
    <Link
      href={p.href}
      className={`group relative flex flex-col overflow-hidden rounded-xl p-6 text-white ${tall ? "min-h-[26rem]" : "min-h-60"}`}
      style={{ background: `linear-gradient(160deg, ${p.bg}, ${p.bg}dd 50%, ${p.tint}55)` }}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl uppercase leading-tight md:text-[1.7rem]">{p.title}</h3>
        {brand && <BrandMark brand={brand} small />}
      </div>
      <p className="relative z-10 mt-2 max-w-xs text-white/85">{p.text}</p>
      <span className="btn btn-light relative z-10 mt-4 w-fit">Shop now</span>
      <Icon
        className={`absolute -bottom-6 -right-6 transition duration-500 group-hover:scale-110 ${tall ? "h-72 w-72" : "h-44 w-44"}`}
        strokeWidth={1}
        style={{ color: p.tint }}
      />
    </Link>
  );
}

function Banner({ title, text, href, bg, icon, brand }: { title: string; text: string; href: string; bg: string; icon: IconKey; brand?: Brand }) {
  const Icon = ICONS[icon];
  return (
    <Link href={href} className={`group relative flex min-h-72 flex-col justify-center overflow-hidden rounded-xl bg-gradient-to-r p-8 text-white ${bg}`}>
      {brand && <BrandMark brand={brand} />}
      <h3 className="mt-4 font-display text-3xl uppercase">{title}</h3>
      <p className="mt-2 max-w-sm text-white/90">{text}</p>
      <span className="btn btn-light mt-5 w-fit">Shop now</span>
      <Icon className="absolute -right-8 top-1/2 h-64 w-64 -translate-y-1/2 text-white/20 transition group-hover:scale-110" strokeWidth={1} />
    </Link>
  );
}

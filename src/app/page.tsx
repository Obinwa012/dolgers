import { BadgePercent, Plus, ShieldCheck, Tag, Truck, Zap } from "lucide-react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import AddBundle from "@/components/home/AddBundle";
import FeaturedTabs from "@/components/home/FeaturedTabs";
import HeroCarousel, { type HeroSlide } from "@/components/home/HeroCarousel";
import Reviews from "@/components/home/Reviews";
import Newsletter from "@/components/Newsletter";
import ProductCard from "@/components/ProductCard";
import Rail from "@/components/Rail";
import Stars from "@/components/Stars";
import ToolArt, { ICONS } from "@/components/ToolArt";
import { reviews } from "@/data/catalog";
import { getBrands, getCategories, getPosts, getProducts, getSellers, money, onSale } from "@/lib/catalog";
import { SELF_SELLER } from "@/lib/marketplace";
import { BUNDLES, toCents } from "@/lib/pricing";
import type { Brand, IconKey, Product } from "@/lib/types";
import { DENSE_RAIL } from "@/lib/ui";

export const revalidate = 300;

const perks = [
  { icon: Truck, title: "Free Shipping Over $99", text: "Dispatched same day before 2pm." },
  { icon: ShieldCheck, title: "3-Year Tool Warranty", text: "On power tools sold by Torqline." },
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
  const [products, categories, brands, posts, sellers] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
    getPosts(),
    getSellers(),
  ]);
  const brandOf = (slug: string) => brands.find((b) => b.slug === slug);
  const byId = new Map(products.map((p) => [p.id, p]));
  const newArrivals = products.filter((p) => p.tags.includes("new")).slice(0, 12);
  const clearance = products.filter((p) => p.tags.includes("clearance"));
  const tabs = categories.filter((c) =>
    ["power-tools", "hand-tools", "storage", "power-supplies", "lawn-garden"].includes(c.slug),
  );
  const marketplaceSellers = sellers.filter((s) => s.slug !== SELF_SELLER);

  // Every number in the promo copy is computed from the catalog so it can't drift from real prices.
  const slides = heroSlides(products, marketplaceSellers.length);
  const categoryDeals = categories
    .map((c) => {
      const onSaleHere = products.filter((p) => p.category === c.slug && onSale(p));
      return { c, count: onSaleHere.length, pct: Math.max(0, ...onSaleHere.map(maxPercentOff)) };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.pct - a.pct);
  const bundles = BUNDLES.map((b) => {
    const items = b.items.map((i) => ({ ...i, product: byId.get(i.productId), variant: byId.get(i.productId)?.variants.find((v) => v.id === i.variantId) }));
    if (items.some((i) => !i.product || !i.variant || i.product.stock <= 0)) return null;
    const full = items.reduce((n, i) => n + toCents(i.variant!.price), 0);
    const saving = Math.round((full * b.percentOff) / 100);
    return { ...b, items, full, saving };
  }).filter((b) => b !== null);

  return (
    <>
      <HeroCarousel slides={slides} />

      {/* Perks */}
      <section className="border-b bg-white">
        <ul className="container-x grid grid-cols-2 gap-4 py-5 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 lg:justify-center">
              <Icon className="h-8 w-8 shrink-0 text-brand-700" strokeWidth={1.5} />
              <div>
                <p className="font-display text-sm uppercase md:text-base">{title}</p>
                <p className="hidden text-xs text-muted sm:block">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Deals by category */}
      {categoryDeals.length > 0 && (
        <section className="container-x py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl uppercase md:text-3xl">Deals by category</h2>
            <Link href="/collections/all?sale=1" className="text-sm font-semibold text-brand-700 hover:underline">All deals</Link>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0 lg:grid-cols-8">
            {categoryDeals.map(({ c, count, pct }) => {
              const Icon = ICONS[c.icon];
              return (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}?sale=1`}
                  className="group relative flex w-36 shrink-0 flex-col overflow-hidden rounded-lg border bg-white p-4 hover:border-ink md:w-auto"
                >
                  <span className="font-display text-xs uppercase text-sale">Up to</span>
                  <span className="font-display text-3xl leading-none text-sale">{pct}% off</span>
                  <span className="mt-2 text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">{count} deal{count === 1 ? "" : "s"}</span>
                  <Icon aria-hidden className="absolute -bottom-3 -right-3 h-16 w-16 opacity-15 transition group-hover:scale-110" style={{ color: c.tint }} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Top deals + New arrivals */}
      <section className="bg-surface py-12">
        <div className="container-x">
          <div className="mb-8 inline-flex items-center gap-3 bg-sale py-3 pl-5 pr-14 font-display text-3xl uppercase text-accent [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] md:text-4xl">
            <Zap className="h-8 w-8 fill-accent" /> Top deals
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {deals.map((d) => (
              <Link key={d.big} href={d.href} className={`group relative flex min-h-56 flex-col overflow-hidden rounded-lg bg-gradient-to-br p-6 text-white ${d.bg}`}>
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

          <div className="mb-6 mt-14 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl uppercase md:text-3xl">New arrivals</h2>
            <Link href="/collections/all?sort=new" className="text-sm font-semibold text-brand-700 hover:underline">Shop new</Link>
          </div>
          <Rail label="New arrivals" itemClass={DENSE_RAIL}>
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} brand={brandOf(p.brand)} />
            ))}
          </Rail>
        </div>
      </section>

      {/* Bundle offers */}
      {bundles.length > 0 && (
        <section className="container-x py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-2xl uppercase md:text-3xl">Bundle &amp; save</h2>
            <p className="text-sm text-muted">Savings apply automatically in your cart.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {bundles.map((b) => (
              <article key={b.id} className="flex flex-col rounded-xl border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl uppercase">{b.title}</h3>
                  <span className="shrink-0 rounded bg-sale px-2 py-0.5 text-xs font-bold uppercase text-white">{b.percentOff}% off</span>
                </div>
                <p className="mt-1 text-sm text-muted">{b.blurb}</p>
                <ul className="mt-4 flex items-center gap-2">
                  {b.items.map((i, k) => (
                    <li key={i.productId} className="flex items-center gap-2">
                      {k > 0 && <Plus aria-hidden className="h-4 w-4 text-muted" />}
                      <Link href={`/products/${i.product!.slug}`} className="block h-20 w-20 overflow-hidden rounded-md border" title={i.product!.title}>
                        <ToolArt icon={i.product!.icon} tint={i.product!.tint} image={i.product!.image} alt={i.product!.title} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-baseline gap-2 font-display text-2xl">
                  <span className="text-sale">{money((b.full - b.saving) / 100)}</span>
                  <s className="text-sm text-muted">{money(b.full / 100)}</s>
                </p>
                <p className="text-sm font-semibold text-sale">Save {money(b.saving / 100)}</p>
                <AddBundle items={b.items.map(({ productId, variantId }) => ({ productId, variantId }))} className="mt-4 w-full" />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Shop by category */}
      <section className="container-x pb-12">
        <h2 className="mb-6 font-display text-2xl uppercase md:text-3xl">Shop by category</h2>
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
      </section>

      {/* Clearance */}
      {clearance.length > 0 && (
        <section className="bg-ink py-12 text-white">
          <div className="container-x">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-display uppercase tracking-[0.2em] text-accent"><Tag className="h-4 w-4" /> Clearance</p>
                <h2 className="font-display text-3xl uppercase md:text-4xl">Last chance, lowest prices</h2>
                <p className="text-sm text-white/70">Limited stock. Once it&apos;s gone, it&apos;s gone.</p>
              </div>
              <Link href="/collections/all?clearance=1" className="btn btn-light">Shop all clearance</Link>
            </div>
            <Rail label="Clearance" itemClass={DENSE_RAIL}>
              {clearance.map((p) => (
                <ProductCard key={p.id} product={p} brand={brandOf(p.brand)} />
              ))}
            </Rail>
          </div>
        </section>
      )}

      {/* Promo mosaic */}
      <section className="container-x py-12">
        <div className="grid gap-4 md:grid-cols-[1fr_1.25fr_0.75fr]">
          <div className="grid gap-4">
            <PromoCard p={promos[0]} brand={brandOf(promos[0].brand)} tall />
            <PromoCard p={promos[1]} brand={brandOf(promos[1].brand)} />
          </div>
          <div className="grid gap-4">
            <PromoCard p={promos[2]} brand={brandOf(promos[2].brand)} />
            <PromoCard p={promos[3]} brand={brandOf(promos[3].brand)} tall />
          </div>
          <div className="grid gap-4">
            <PromoCard p={promos[4]} brand={brandOf(promos[4].brand)} tall />
            <PromoCard p={promos[5]} brand={brandOf(promos[5].brand)} />
          </div>
        </div>
      </section>

      {/* Featured tabs */}
      <section className="bg-surface py-12">
        <div className="container-x">
          <h2 className="section-title mb-6">Featured products</h2>
          <FeaturedTabs tabs={tabs} products={products} brands={brands} />
        </div>
      </section>

      {/* Two banners */}
      <section className="container-x grid gap-4 py-12 md:grid-cols-2">
        <Banner title="High-output batteries" text="Longer runtime and more torque from the latest cell tech." href="/collections/power-supplies" bg="from-cyan-800 to-cyan-500" icon="battery" brand={brandOf("brunn")} />
        <Banner title="Welding & metalwork" text="Grinders, welders and PPE for clean, safe fabrication." href="/collections/welding" bg="from-orange-900 to-orange-600" icon="flame" brand={brandOf("voltra")} />
      </section>

      {/* Marketplace sellers */}
      {marketplaceSellers.length > 0 && (
        <section className="container-x pb-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl uppercase md:text-3xl">Shop the marketplace</h2>
              <p className="text-sm text-muted">Specialist sellers, vetted by Torqline. Returns are backed by us if a seller doesn&apos;t sort it out.</p>
            </div>
            <Link href="/sellers" className="text-sm font-semibold text-brand-700 hover:underline">All sellers</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marketplaceSellers.map((s) => (
              <Link key={s.slug} href={`/sellers/${s.slug}`} className="flex items-center gap-4 rounded-xl border p-5 hover:border-ink">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-xl text-white" style={{ background: s.color }}>
                  {s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <span>
                  <span className="block font-display text-lg">{s.name}</span>
                  <span className="block text-xs text-muted">{s.tagline}</span>
                  <Stars rating={s.rating} count={s.ratingCount} />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-5">
            <p><b className="font-display uppercase">Sell on Torqline.</b> <span className="text-muted">Reach trades and serious DIYers with payouts handled for you.</span></p>
            <Link href="/sell" className="btn btn-brand">Become a seller</Link>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="bg-surface py-12">
        <div className="container-x">
          <h2 className="section-title mb-10">What the trades say</h2>
          <Reviews reviews={reviews} />
        </div>
      </section>

      {/* Brands */}
      <section className="container-x py-12">
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

      {/* Newsletter strip */}
      <section className="bg-brand-700 text-white">
        <div className="container-x flex flex-col items-center gap-5 py-10 md:flex-row md:justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase md:text-3xl">Want first dibs on deals?</h2>
            <p className="text-white/80">Join the list for flash sales, new releases and trade tips.</p>
          </div>
          <div className="w-full md:max-w-lg">
            <Newsletter />
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="container-x py-14">
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

const maxPercentOff = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? Math.floor((1 - v.price / v.compareAtPrice) * 100) : 0)));
const maxSaving = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice - v.price : 0)));

/** Hero slides. Each is dropped if the catalog no longer backs its claim. */
function heroSlides(products: Product[], sellerCount: number): HeroSlide[] {
  const slides: HeroSlide[] = [];
  const special = products.find((p) => p.slug === "voltra-18v-brushless-4-tool-combo-kit" && p.stock > 0 && onSale(p));
  if (special) {
    const v = special.variants.reduce((a, b) => (maxSaving({ ...special, variants: [b] }) > maxSaving({ ...special, variants: [a] }) ? b : a));
    slides.push({
      id: "special-buy", eyebrow: "Special buy of the day", title: "4 tools. 2 batteries. One price.",
      text: special.title, callout: money(v.price), calloutNote: `was ${money(v.compareAtPrice!)} · save ${money(v.compareAtPrice! - v.price)}`,
      cta: "Grab the deal", href: `/products/${special.slug}`, icon: "drill",
      bg: "radial-gradient(circle at 75% 50%, #b4530955, transparent 55%), linear-gradient(120deg, #111418 30%, #3b1d0a)", accent: "#f5b400",
    });
  }
  const combos = products.filter((p) => p.subcategory === "combo-kits");
  const comboSave = Math.max(0, ...combos.map(maxSaving));
  if (comboSave > 0)
    slides.push({
      id: "combo-kits", eyebrow: "Combo kit event", title: `Save up to ${money(comboSave).replace(/\.00$/, "")} on combo kits`,
      text: "Drill, driver and saw bundles with batteries and chargers included. Start a platform for less.",
      cta: "Shop combo kits", href: "/collections/power-tools?sub=combo-kits", icon: "box",
      bg: "radial-gradient(circle at 75% 50%, #13808f66, transparent 55%), linear-gradient(120deg, #062f36 30%, #0a5561)", accent: "#f5b400",
    });
  const clear = products.filter((p) => p.tags.includes("clearance"));
  const clearPct = Math.max(0, ...clear.map(maxPercentOff));
  if (clearPct > 0)
    slides.push({
      id: "clearance", eyebrow: "Clearance", title: `Up to ${clearPct}% off, while it lasts`,
      text: `${clear.length} lines marked down to make room for new stock. Limited quantities.`,
      cta: "Shop clearance", href: "/collections/all?clearance=1", icon: "ruler",
      bg: "radial-gradient(circle at 75% 50%, #d6263b55, transparent 55%), linear-gradient(120deg, #111418 30%, #4a0d15)", accent: "#ffffff",
    });
  if (sellerCount > 0)
    slides.push({
      id: "marketplace", eyebrow: "New: Torqline Marketplace", title: "More sellers. More stock.",
      text: `Shop ${sellerCount} specialist sellers alongside Torqline, with ratings on every listing and returns backed by us.`,
      cta: "Meet the sellers", href: "/sellers", icon: "sprout",
      bg: "radial-gradient(circle at 75% 50%, #4d7c0f66, transparent 55%), linear-gradient(120deg, #0f1f0a 30%, #1f3a0f)", accent: "#a3e635",
    });
  return slides;
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

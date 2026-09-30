import { SlidersHorizontal, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { getBrands, getCategories, getProducts, getSellers, minPrice } from "@/lib/catalog";
import { SELF_SELLER, VOLTAGES } from "@/lib/marketplace";
import { FILTER_KEYS, filterProducts, parseFilters, PRICE_BUCKETS, type Filters } from "@/lib/shopping";
import type { Brand, Category, Product, Seller } from "@/lib/types";

export const revalidate = 300;

const SORTS = {
  featured: "Featured",
  new: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
  savings: "Biggest savings",
} as const;

const saving = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice - v.price : 0)));

export async function generateMetadata(props: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: slug === "all" ? "All products" : (cat?.name ?? "Collection") };
}

export default async function CollectionPage(props: PageProps<"/collections/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const [products, categories, brands, sellers] = await Promise.all([getProducts(), getCategories(), getBrands(), getSellers()]);
  const cat = categories.find((c) => c.slug === slug);
  if (slug !== "all" && !cat) notFound();

  const f = parseFilters(str);
  const sort = (Object.hasOwn(SORTS, str("sort")) ? str("sort") : "featured") as keyof typeof SORTS;
  const base = products.filter((p) => slug === "all" || p.category === slug);
  const list = [...filterProducts(base, f)].sort((a, b) => {
    switch (sort) {
      case "new": return b.createdAt - a.createdAt;
      case "price-asc": return minPrice(a) - minPrice(b);
      case "price-desc": return minPrice(b) - minPrice(a);
      case "rating": return b.rating - a.rating;
      case "savings": return saving(b) - saving(a);
      default: return Number(b.tags.includes("featured")) - Number(a.tags.includes("featured"));
    }
  });

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const k of [...FILTER_KEYS, "sort"]) if (str(k)) next.set(k, str(k));
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return `/collections/${slug}${s ? `?${s}` : ""}`;
  };
  // How many results a filter option would give, holding every other filter fixed.
  const countWith = (patch: Partial<Filters>) => filterProducts(base, { ...f, ...patch }).length;

  const sub = cat?.subcategories?.find((s) => s.slug === f.sub);
  const title = f.q
    ? `Results for “${f.q}”`
    : f.clearance ? "Clearance"
    : f.sale && !cat ? "Deals"
    : (sub?.name ?? cat?.name ?? "All products");

  const chips = activeChips(f, { brands, sellers, sub: sub?.name });
  const panel = <FilterPanel f={f} slug={slug} cat={cat} categories={categories} brands={brands} sellers={sellers} href={href} countWith={countWith} sort={sort} />;

  return (
    <div className="container-x py-8">
      <nav className="mb-3 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        {cat && sub ? <><Link href={`/collections/${cat.slug}`} className="hover:text-ink">{cat.name}</Link> / </> : null}
        <span className="text-ink">{title}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase md:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">{list.length} product{list.length === 1 ? "" : "s"}</p>
        </div>
        <form action={`/collections/${slug}`} className="flex items-center gap-2 text-sm">
          {[...FILTER_KEYS].map((k) => str(k) && <input key={k} type="hidden" name={k} value={str(k)} />)}
          <label htmlFor="sort" className="text-muted">Sort</label>
          <select id="sort" name="sort" defaultValue={sort} className="input w-auto! py-1.5!">
            {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <button className="btn btn-outline px-3! py-1.5!">Go</button>
        </form>
      </div>

      {cat?.subcategories && (
        <ul className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <li><Link href={href({ sub: null })} className={`block whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${!f.sub ? "border-ink bg-ink text-white" : "hover:border-ink"}`}>All {cat.name}</Link></li>
          {cat.subcategories.map((s) => (
            <li key={s.slug}>
              <Link href={href({ sub: f.sub === s.slug ? null : s.slug })} className={`block whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${f.sub === s.slug ? "border-ink bg-ink text-white" : "hover:border-ink"}`}>
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {chips.map((c) => (
            <Link key={c.label} href={href(c.clear)} className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-brand-800 hover:bg-brand-100">
              {c.label} <X className="h-3.5 w-3.5" aria-label="remove" />
            </Link>
          ))}
          <Link href={`/collections/${slug}`} className="ml-1 underline">Clear all</Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]">
        <details className="rounded-lg border lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 p-3 font-display uppercase">
            <SlidersHorizontal className="h-4 w-4" /> Filters{chips.length ? ` (${chips.length})` : ""}
          </summary>
          <div className="border-t p-4">{panel}</div>
        </details>
        <aside className="hidden lg:block">{panel}</aside>

        <div>
          {list.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted">
              Nothing matches those filters.{" "}
              <Link href={`/collections/${slug}`} className="text-brand-700 underline">Clear filters</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function activeChips(f: Filters, ctx: { brands: Brand[]; sellers: Seller[]; sub?: string }) {
  const out: { label: string; clear: Record<string, string | null> }[] = [];
  if (f.q) out.push({ label: `“${f.q}”`, clear: { q: null } });
  if (ctx.sub) out.push({ label: ctx.sub, clear: { sub: null } });
  if (f.brand) out.push({ label: ctx.brands.find((b) => b.slug === f.brand)?.name ?? f.brand, clear: { brand: null } });
  for (const v of f.voltage)
    out.push({ label: v, clear: { voltage: f.voltage.filter((x) => x !== v).join(",") || null } });
  if (f.battery) out.push({ label: "Battery included", clear: { battery: null } });
  if (f.inStock) out.push({ label: "In stock", clear: { stock: null } });
  if (f.sale) out.push({ label: "On sale", clear: { sale: null } });
  if (f.clearance) out.push({ label: "Clearance", clear: { clearance: null } });
  if (f.min !== null || f.max !== null)
    out.push({ label: f.min !== null && f.max !== null ? `$${f.min}–$${f.max}` : f.min !== null ? `$${f.min}+` : `Under $${f.max}`, clear: { min: null, max: null } });
  if (f.seller)
    out.push({
      label: f.seller === SELF_SELLER ? "Sold by Dolgers" : f.seller === "marketplace" ? "Marketplace sellers" : (ctx.sellers.find((s) => s.slug === f.seller)?.name ?? f.seller),
      clear: { seller: null },
    });
  return out;
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 font-display text-base uppercase">{children}</h2>;
}

function Check({ on, href, children, count }: { on: boolean; href: string; children: React.ReactNode; count?: number }) {
  const disabled = !on && count === 0;
  return (
    <li>
      <Link
        href={href}
        aria-disabled={disabled || undefined}
        className={`flex items-center gap-2 ${disabled ? "pointer-events-none text-slate-400" : "hover:text-brand-600"}`}
        rel="nofollow"
      >
        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-brand-700 bg-brand-700" : "border-slate-400"}`}>
          {on && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
        </span>
        <span className="flex-1">{children}</span>
        {count !== undefined && <span className="text-xs text-muted">{count}</span>}
      </Link>
    </li>
  );
}

function FilterPanel({
  f, slug, cat, categories, brands, sellers, href, countWith, sort,
}: {
  f: Filters;
  slug: string;
  cat?: Category;
  categories: Category[];
  brands: Brand[];
  sellers: Seller[];
  href: (patch: Record<string, string | null>) => string;
  countWith: (patch: Partial<Filters>) => number;
  sort: string;
}) {
  const toggleVoltage = (v: string) => {
    const set = new Set<string>(f.voltage);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    return [...set].join(",") || null;
  };
  const marketplace = sellers.filter((s) => s.slug !== SELF_SELLER);

  return (
    <div className="space-y-6 text-sm">
      <section>
        <H>Category</H>
        <ul className="space-y-1.5">
          <li><Link href="/collections/all" className={slug === "all" ? "font-semibold text-brand-700" : "hover:text-brand-600"}>All products</Link></li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/collections/${c.slug}`} className={c.slug === cat?.slug ? "font-semibold text-brand-700" : "hover:text-brand-600"}>{c.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <H>Availability</H>
        <ul className="space-y-1.5">
          <Check on={f.inStock} href={href({ stock: f.inStock ? null : "in" })} count={countWith({ inStock: true })}>In stock</Check>
          <Check on={f.sale} href={href({ sale: f.sale ? null : "1" })} count={countWith({ sale: true })}>On sale</Check>
          <Check on={f.clearance} href={href({ clearance: f.clearance ? null : "1" })} count={countWith({ clearance: true })}>Clearance</Check>
        </ul>
      </section>

      <section>
        <H>Voltage</H>
        <ul className="space-y-1.5">
          {VOLTAGES.map((v) => (
            <Check key={v} on={f.voltage.includes(v)} href={href({ voltage: toggleVoltage(v) })} count={countWith({ voltage: [v] })}>
              {v === "Manual" ? "No power (hand tools)" : v}
            </Check>
          ))}
        </ul>
      </section>

      <section>
        <H>Battery</H>
        <ul className="space-y-1.5">
          <Check on={f.battery} href={href({ battery: f.battery ? null : "1" })} count={countWith({ battery: true })}>Battery included</Check>
        </ul>
      </section>

      <section>
        <H>Price</H>
        <ul className="space-y-1.5">
          {PRICE_BUCKETS.map((b) => {
            const on = f.min === b.min && f.max === b.max;
            return (
              <Check
                key={b.label}
                on={on}
                href={href(on ? { min: null, max: null } : { min: b.min === null ? null : String(b.min), max: b.max === null ? null : String(b.max) })}
                count={countWith({ min: b.min, max: b.max })}
              >
                {b.label}
              </Check>
            );
          })}
        </ul>
        <form action={`/collections/${slug}`} className="mt-3 flex items-center gap-2">
          {[...FILTER_KEYS, "sort"].filter((k) => k !== "min" && k !== "max").map((k) => {
            const v = k === "sort" ? (sort === "featured" ? "" : sort) : hiddenValue(f, k);
            return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
          })}
          <input name="min" type="number" min={0} inputMode="numeric" placeholder="$ Min" defaultValue={f.min ?? ""} aria-label="Minimum price" className="input px-2! py-1.5!" />
          <span className="text-muted">–</span>
          <input name="max" type="number" min={0} inputMode="numeric" placeholder="$ Max" defaultValue={f.max ?? ""} aria-label="Maximum price" className="input px-2! py-1.5!" />
          <button className="btn btn-outline px-3! py-1.5!">Go</button>
        </form>
      </section>

      <section>
        <H>Seller</H>
        <ul className="space-y-1.5">
          <Check on={f.seller === SELF_SELLER} href={href({ seller: f.seller === SELF_SELLER ? null : SELF_SELLER })} count={countWith({ seller: SELF_SELLER })}>
            Sold by Dolgers
          </Check>
          <Check on={f.seller === "marketplace"} href={href({ seller: f.seller === "marketplace" ? null : "marketplace" })} count={countWith({ seller: "marketplace" })}>
            Other sellers
          </Check>
        </ul>
        <ul className="mt-2 space-y-1.5 border-l pl-3">
          {marketplace.map((s) => (
            <Check key={s.slug} on={f.seller === s.slug} href={href({ seller: f.seller === s.slug ? null : s.slug })} count={countWith({ seller: s.slug })}>
              {s.name} <span className="text-xs text-muted">{s.rating.toFixed(1)}★</span>
            </Check>
          ))}
        </ul>
      </section>

      <section>
        <H>Brand</H>
        <ul className="space-y-1.5">
          {brands.map((b) => (
            <Check key={b.slug} on={f.brand === b.slug} href={href({ brand: f.brand === b.slug ? null : b.slug })} count={countWith({ brand: b.slug })}>
              {b.name}
            </Check>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** URL value for a filter key, for hidden inputs in GET forms. */
function hiddenValue(f: Filters, k: string): string {
  switch (k) {
    case "q": return f.q;
    case "brand": return f.brand;
    case "sub": return f.sub;
    case "sale": return f.sale ? "1" : "";
    case "clearance": return f.clearance ? "1" : "";
    case "voltage": return f.voltage.join(",");
    case "battery": return f.battery ? "1" : "";
    case "stock": return f.inStock ? "in" : "";
    case "seller": return f.seller;
    default: return "";
  }
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { getBrands, getCategories, getProducts, minPrice, onSale } from "@/lib/catalog";

export const revalidate = 300;

const SORTS = {
  featured: "Featured",
  new: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
} as const;

export async function generateMetadata(props: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: slug === "all" ? "All products" : (cat?.name ?? "Collection") };
}

export default async function CollectionPage(props: PageProps<"/collections/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const [products, categories, brands] = await Promise.all([getProducts(), getCategories(), getBrands()]);
  const cat = categories.find((c) => c.slug === slug);
  if (slug !== "all" && !cat) notFound();

  const q = str("q").toLowerCase();
  const brand = str("brand");
  const sale = str("sale") === "1";
  const sort = (str("sort") in SORTS ? str("sort") : "featured") as keyof typeof SORTS;

  let list = products.filter((p) => slug === "all" || p.category === slug);
  if (q) list = list.filter((p) => `${p.title} ${p.description} ${p.brand} ${p.category}`.toLowerCase().includes(q));
  if (brand) list = list.filter((p) => p.brand === brand);
  if (sale) list = list.filter(onSale);
  list = [...list].sort((a, b) => {
    switch (sort) {
      case "new": return b.createdAt - a.createdAt;
      case "price-asc": return minPrice(a) - minPrice(b);
      case "price-desc": return minPrice(b) - minPrice(a);
      case "rating": return b.rating - a.rating;
      default: return Number(b.tags.includes("featured")) - Number(a.tags.includes("featured"));
    }
  });

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const k of ["q", "brand", "sale", "sort"]) if (str(k)) next.set(k, str(k));
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return `/collections/${slug}${s ? `?${s}` : ""}`;
  };

  const title = q ? `Results for “${str("q")}”` : sale ? "Deals" : (cat?.name ?? "All products");

  return (
    <div className="container-x py-10">
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> / <span className="text-ink">{title}</span>
      </nav>
      <h1 className="font-display text-4xl uppercase">{title}</h1>
      <p className="mt-1 text-sm text-muted">{list.length} product{list.length === 1 ? "" : "s"}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-8 text-sm">
          <div>
            <h2 className="mb-3 font-display text-lg uppercase">Category</h2>
            <ul className="space-y-2">
              <li><Link href="/collections/all" className={slug === "all" ? "font-semibold text-brand-700" : "hover:text-brand-600"}>All products</Link></li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`} className={c.slug === slug ? "font-semibold text-brand-700" : "hover:text-brand-600"}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-display text-lg uppercase">Brand</h2>
            <ul className="space-y-2">
              {brands.map((b) => (
                <li key={b.slug}>
                  <Link href={href({ brand: brand === b.slug ? null : b.slug })} className="flex items-center gap-2 hover:text-brand-600">
                    <span className={`grid h-4 w-4 place-items-center rounded border ${brand === b.slug ? "border-brand-700 bg-brand-700" : "border-slate-400"}`}>
                      {brand === b.slug && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href={href({ sale: sale ? null : "1" })} className="flex items-center gap-2 hover:text-brand-600">
            <span className={`h-4 w-4 rounded border ${sale ? "border-sale bg-sale" : "border-slate-400"}`} />
            On sale only
          </Link>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap gap-2 text-sm">
            {Object.entries(SORTS).map(([k, label]) => (
              <Link
                key={k}
                href={href({ sort: k === "featured" ? null : k })}
                className={`rounded-full border px-3 py-1.5 ${sort === k ? "border-ink bg-ink text-white" : "border-slate-300 hover:border-ink"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {list.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
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

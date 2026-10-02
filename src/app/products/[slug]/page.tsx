import { BadgeCheck, MessageCircleQuestion, RotateCcw, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import ProductCard from "@/components/ProductCard";
import AskQuestion from "@/components/product/AskQuestion";
import BoughtTogether from "@/components/product/BoughtTogether";
import BuyBox from "@/components/product/BuyBox";
import Stars from "@/components/Stars";
import ClothingArt from "@/components/ClothingArt";
import { getBrands, getCategories, getProduct, getProducts, getSellers, minPrice, money } from "@/lib/catalog";
import { SELF_SELLER, sellerOf } from "@/lib/marketplace";
import { boughtTogether, compareSet, fullSpecs, policyLines } from "@/lib/shopping";
import type { Product, Seller } from "@/lib/types";

export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProduct(slug);
  return { title: p?.title ?? "Product", description: p?.description };
}

const sections = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specifications" },
  { id: "questions", label: "Questions & answers" },
  { id: "compare", label: "Compare" },
];

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [brands, categories, all, sellers] = await Promise.all([getBrands(), getCategories(), getProducts(), getSellers()]);
  const brand = brands.find((b) => b.slug === product.brand);
  const cat = categories.find((c) => c.slug === product.category);
  const sub = cat?.subcategories?.find((s) => s.slug === product.subcategory);
  const seller = sellers.find((s) => s.slug === sellerOf(product));
  const sellerName = (p: Product) => sellers.find((s) => s.slug === sellerOf(p))?.name ?? "Dolgers";
  const fbt = boughtTogether(product, all);
  const compare = [product, ...compareSet(product, all)];
  const related = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 6);
  const specs = fullSpecs(product, { brand: brand?.name, category: sub ? `${cat?.name} › ${sub.name}` : cat?.name, seller: seller?.name });
  const qa = product.qa ?? [];

  return (
    <div className="container-x py-8">
      <nav className="mb-5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        {cat && <><Link href={`/collections/${cat.slug}`} className="hover:text-ink">{cat.name}</Link> / </>}
        {cat && sub && <><Link href={`/collections/${cat.slug}?sub=${sub.slug}`} className="hover:text-ink">{sub.name}</Link> / </>}
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_1fr]">
        <div className="lg:sticky lg:top-40 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-xl border">
            <ClothingArt icon={product.icon} tint={product.tint} image={product.image} alt={product.title} />
            {product.tags.includes("clearance") && (
              <span className="absolute left-4 top-4 rounded bg-ink px-2 py-1 text-xs font-bold uppercase text-accent">Clearance</span>
            )}
          </div>
        </div>
        <div>
          {brand && <Link href={`/brands/${brand.slug}`}><BrandMark brand={brand} /></Link>}
          <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">{product.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href="#questions" className="hover:underline"><Stars rating={product.rating} count={product.reviewCount} size="md" /></a>
            <a href="#questions" className="text-brand-700 hover:underline">{qa.length} answered question{qa.length === 1 ? "" : "s"}</a>
            <span className="text-muted">SKU {product.slug.toUpperCase()}</span>
          </div>

          <BuyBox product={product} />

          {seller && <SoldBy seller={seller} />}
        </div>
      </div>

      <nav aria-label="Product sections" className="no-scrollbar sticky top-[116px] z-10 -mx-4 mt-12 flex gap-6 overflow-x-auto border-b bg-white px-4 md:top-[72px] md:mx-0 md:px-0 lg:top-[128px]">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 border-b-2 border-transparent py-3 font-display text-sm uppercase hover:border-ink">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-8 grid gap-12 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-14">
          <section id="overview" className="scroll-mt-48">
            <h2 className="mb-3 font-display text-2xl uppercase">Overview</h2>
            <p className="max-w-3xl leading-relaxed text-muted">{product.description}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {product.specs.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {s}</li>
              ))}
            </ul>
          </section>

          {fbt.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-2xl uppercase">Complete the look</h2>
              <BoughtTogether product={product} others={fbt} />
            </section>
          )}

          <section id="specs" className="scroll-mt-48">
            <h2 className="mb-4 font-display text-2xl uppercase">Specifications</h2>
            <table className="w-full overflow-hidden rounded-lg border text-sm">
              <tbody className="divide-y">
                {specs.map((r, i) => (
                  <tr key={`${r.label}-${i}`} className="odd:bg-surface">
                    <th scope="row" className="w-2/5 px-4 py-2.5 text-left font-medium">{r.label}</th>
                    <td className="px-4 py-2.5 text-muted">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="questions" className="scroll-mt-48">
            <h2 className="mb-4 font-display text-2xl uppercase">Questions &amp; answers</h2>
            {qa.length ? (
              <ul className="divide-y rounded-lg border">
                {qa.map((x, i) => (
                  <li key={i} className="p-4 text-sm">
                    <p className="flex gap-2 font-semibold"><span className="text-brand-700">Q:</span> {x.q}</p>
                    <p className="mt-1.5 flex gap-2"><span className="font-semibold text-muted">A:</span> <span>{x.a}</span></p>
                    <p className="mt-1.5 pl-6 text-xs text-muted">
                      {x.by === "seller" ? `Answered by ${seller?.name ?? "the seller"}` : "Answered by a customer"} ·{" "}
                      {new Date(x.date).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted">
                <MessageCircleQuestion className="h-5 w-5" /> No questions yet. Be the first to ask.
              </p>
            )}
            <div className="mt-4">
              <AskQuestion productId={product.id} seller={sellerOf(product)} slug={product.slug} />
            </div>
          </section>

          {compare.length > 1 && (
            <section id="compare" className="scroll-mt-48">
              <h2 className="mb-4 font-display text-2xl uppercase">Compare similar items</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="align-top">
                      <th scope="col" className="w-36 p-3 text-left"><span className="sr-only">Feature</span></th>
                      {compare.map((p, i) => (
                        <th key={p.id} scope="col" className={`p-3 text-left font-normal ${i === 0 ? "bg-brand-50" : ""}`}>
                          <Link href={`/products/${p.slug}`} className="block">
                            <span className="block aspect-square w-24 overflow-hidden rounded border"><ClothingArt icon={p.icon} tint={p.tint} image={p.image} alt="" /></span>
                            <span className="mt-2 line-clamp-2 font-medium hover:text-brand-700">{p.title}</span>
                          </Link>
                          {i === 0 && <span className="mt-1 inline-block text-xs font-semibold uppercase text-brand-700">This item</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <CompareRow label="Price" items={compare} cell={(p) => <b className="font-display text-base">{p.variants.length > 1 ? "From " : ""}{money(minPrice(p))}</b>} />
                    <CompareRow label="Rating" items={compare} cell={(p) => <Stars rating={p.rating} count={p.reviewCount} />} />
                    <CompareRow label="Fit" items={compare} cell={(p) => p.fit ?? "—"} />
                    <CompareRow label="Sold by" items={compare} cell={(p) => sellerName(p)} />
                    <CompareRow label="Availability" items={compare} cell={(p) => (p.stock > 0 ? "In stock" : "Out of stock")} />
                    <CompareRow label="Highlights" items={compare} cell={(p) => <ul className="list-disc space-y-0.5 pl-4">{p.specs.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ul>} />
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-48 space-y-4">
            {seller && <PolicyCard seller={seller} />}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl uppercase">More in {cat?.name ?? "this category"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {related.map((p) => <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function CompareRow({ label, items, cell }: { label: string; items: Product[]; cell: (p: Product) => React.ReactNode }) {
  return (
    <tr className="align-top">
      <th scope="row" className="p-3 text-left font-medium">{label}</th>
      {items.map((p, i) => <td key={p.id} className={`p-3 ${i === 0 ? "bg-brand-50" : ""}`}>{cell(p)}</td>)}
    </tr>
  );
}

function SoldBy({ seller }: { seller: Seller }) {
  const policy = policyLines(seller);
  const self = seller.slug === SELF_SELLER;
  return (
    <div className="mt-6 space-y-3 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Store className="h-5 w-5 text-brand-700" />
        <span>
          Sold and shipped by{" "}
          <Link href={`/sellers/${seller.slug}`} className="font-semibold text-brand-700 hover:underline">{seller.name}</Link>
        </span>
        <Stars rating={seller.rating} count={seller.ratingCount} />
      </div>
      <p className="flex items-start gap-2"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {policy.returns}</p>
      <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {policy.warranty}</p>
      {!self && (
        <p className="text-xs text-muted">
          Marketplace item. Payment is taken by Dolgers; if a return or problem isn&apos;t resolved by the seller, open a case from your account and we&apos;ll step in.
        </p>
      )}
    </div>
  );
}

function PolicyCard({ seller }: { seller: Seller }) {
  return (
    <div className="rounded-lg bg-surface p-5 text-sm">
      <h2 className="font-display text-lg uppercase">About the seller</h2>
      <p className="mt-2 font-semibold">{seller.name}</p>
      <p className="text-muted">{seller.location} · on Dolgers since {seller.since.slice(0, 4)}</p>
      <p className="mt-2 text-muted">{seller.about}</p>
      <Link href={`/sellers/${seller.slug}`} className="btn btn-outline mt-4 w-full">Visit storefront</Link>
    </div>
  );
}

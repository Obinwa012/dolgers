import { Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import ProductCard from "@/components/ProductCard";
import BuyBox from "@/components/product/BuyBox";
import ToolArt from "@/components/ToolArt";
import { getBrands, getCategories, getProduct, getProducts } from "@/lib/catalog";

export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProduct(slug);
  return { title: p?.title ?? "Product", description: p?.description };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [brands, categories, all] = await Promise.all([getBrands(), getCategories(), getProducts()]);
  const brand = brands.find((b) => b.slug === product.brand);
  const cat = categories.find((c) => c.slug === product.category);
  const related = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="container-x py-10">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        {cat && <><Link href={`/collections/${cat.slug}`} className="hover:text-ink">{cat.name}</Link> / </>}
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl border">
          <ToolArt icon={product.icon} tint={product.tint} image={product.image} alt={product.title} />
        </div>
        <div>
          {brand && <Link href={`/brands/${brand.slug}`}><BrandMark brand={brand} /></Link>}
          <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">{product.title}</h1>
          <p className="mt-3 flex items-center gap-1 text-sm text-muted">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-accent text-accent" : "text-slate-300"}`} />
            ))}
            <span className="ml-1">{product.rating.toFixed(1)} · {product.reviewCount} reviews</span>
          </p>
          <BuyBox product={product} />
          <div className="mt-10 space-y-6 border-t pt-8">
            <div>
              <h2 className="mb-2 font-display text-xl uppercase">Overview</h2>
              <p className="leading-relaxed text-muted">{product.description}</p>
            </div>
            <div>
              <h2 className="mb-2 font-display text-xl uppercase">Specifications</h2>
              <ul className="divide-y rounded-lg border text-sm">
                {product.specs.map((s) => <li key={s} className="px-4 py-2.5">{s}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="section-title mb-8">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} brand={brands.find((b) => b.slug === p.brand)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

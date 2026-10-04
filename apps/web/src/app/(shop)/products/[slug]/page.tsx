import { Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DELIVERY, RETURN_WINDOW_DAYS, formatMoney, type Product, type SizeSystem, type Vendor } from '@dolgers/shared';
import { ProductCard } from '@/components/ProductCard';
import { Breadcrumbs, SectionHeading } from '@/components/ui';
import { Accordion } from '@/components/shop/Accordion';
import { nowMs, productToCard } from '@/components/shop/cards';
import { Paragraphs } from '@/components/shop/Paragraphs';
import { ProductBuyBox } from '@/components/shop/ProductBuyBox';
import { ProductGallery } from '@/components/shop/ProductGallery';
import { SizeGuideButton } from '@/components/shop/SizeGuideButton';
import { getCategories, getProduct, getProductsByIds, getVendor } from '@/lib/server/catalog';
import { publicEnv } from '@/lib/env';

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: 'Not found' };
  const description = `${product.description.slice(0, 150)}${product.description.length > 150 ? '…' : ''}`;
  const image = product.images.find((i) => i.url);
  const brandName = product.brand ?? product.vendorName;
  return {
    title: `${product.title} by ${brandName}`,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.title, description, images: image ? [{ url: image.url, alt: image.alt }] : undefined },
  };
}

const SIZING_NOTE: Record<SizeSystem, string> = {
  alpha: 'Sized XS to XXL.',
  'eu-shoe': 'Sized in EU shoe sizes; the size guide converts them to US sizes.',
  age: 'Sized by age; check height and chest in the size guide.',
  waist: 'Sized by waist, in inches.',
  'one-size': 'This piece comes in one size.',
};

function dispatchText(vendor: Vendor | null): string {
  const d = vendor?.facts.dispatchDays;
  if (!d) return 'Ships from our US warehouse.';
  return d[0] === d[1] ? `Ships in ${d[0]} working ${d[0] === 1 ? 'day' : 'days'}.` : `Ships in ${d[0]}–${d[1]} working days.`;
}

/** schema.org Product, serialised safely: '<' is escaped so the JSON can never close the script tag. */
function jsonLd(product: Product, vendor: Vendor | null): string {
  const url = new URL(`/products/${product.slug}`, publicEnv.siteUrl).toString();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    sku: product.id,
    color: product.colour.name,
    image: product.images.filter((i) => i.url).map((i) => i.url),
    brand: { '@type': 'Brand', name: product.brand ?? vendor?.name ?? product.vendorName },
    category: product.categoryPath.join(' > '),
    url,
    offers:
      product.priceMin === product.priceMax
        ? { '@type': 'Offer', price: (product.priceMin / 100).toFixed(2), priceCurrency: 'USD', url, seller: { '@type': 'Organization', name: product.vendorName } }
        : { '@type': 'AggregateOffer', lowPrice: (product.priceMin / 100).toFixed(2), highPrice: (product.priceMax / 100).toFixed(2), priceCurrency: 'USD', offerCount: product.variants.length },
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// Always render from live Firestore: never serve a stale pre-built copy of the product.
export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [vendor, categories, related] = await Promise.all([getVendor(product.vendorSlug), getCategories(), getProductsByIds(product.related)]);
  const now = nowMs();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const dept = product.categoryPath[0];
  const deptName = byId.get(dept)?.name ?? dept;

  // Home / Men / Outerwear / Title: department and first-level category, as in the mockup.
  const crumbs = [
    { label: 'Home', href: '/' },
    ...product.categoryPath.slice(0, 2).map((_, i) => {
      const path = product.categoryPath.slice(0, i + 1);
      return { label: byId.get(path.join('--'))?.name ?? path[i], href: `/shop/${path.join('/')}` };
    }),
    { label: product.title },
  ];

  const facts = vendor?.facts;
  const multiPrice = product.priceMax > product.priceMin;

  return (
    <div className="container-page pt-4 md:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(product, vendor) }} />
      <div className="hidden md:block">
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="mt-0 grid gap-8 md:mt-6 md:grid-cols-[1fr_340px] md:gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
        <ProductGallery images={product.images} title={product.title} />

        <div className="md:sticky md:top-28 md:self-start">
          {product.brand ? (
            <p className="label text-muted">{product.brand}</p>
          ) : (
            <Link href={`/brands/${product.vendorSlug}`} className="label text-muted hover:text-ink">{product.vendorName}</Link>
          )}
          <h1 className="display mt-3 text-[34px] md:text-[40px]">{product.title}</h1>
          <p className="mt-4 text-lg font-medium">
            {multiPrice ? `From ${formatMoney(product.priceMin)}` : formatMoney(product.priceMin)}
          </p>

          <div className="mt-6">
            <ProductBuyBox
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                vendorId: product.vendorId,
                vendorName: product.vendorName,
                colour: product.colour,
                sizeSystem: product.sizeSystem,
                variants: product.variants,
                fitNote: product.fitNote,
                priceMin: product.priceMin,
                image: product.images[0] ?? null,
              }}
            />
          </div>

          <div className="mt-6 flex gap-3 bg-stone px-4 py-4 text-[13px]">
            <Truck size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
            <div>
              <p>
                Sold and shipped by <Link href={`/brands/${product.vendorSlug}`} className="underline underline-offset-4">{product.vendorName}</Link>
              </p>
              <p className="mt-1 text-muted">
                {dispatchText(vendor)} Free returns within {RETURN_WINDOW_DAYS} days.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-line">
            <Accordion title="Details & composition" open>
              <Paragraphs text={product.description} />
              {product.composition || product.care ? (
                <p>
                  {product.composition ? <>Composition: {product.composition} </> : null}
                  {product.care ? <>Care: {product.care}</> : null}
                </p>
              ) : null}
              {facts?.madeIn ? <p>Made in {facts.madeIn}.</p> : null}
            </Accordion>
            <Accordion title="Fit & sizing">
              {product.fitNote ? <p>{product.fitNote}</p> : null}
              <p>
                {SIZING_NOTE[product.sizeSystem]}{' '}
                {product.sizeSystem !== 'one-size' ? (
                  <SizeGuideButton sizeSystem={product.sizeSystem} fitNote={product.fitNote} />
                ) : null}
              </p>
            </Accordion>
            <Accordion title="Delivery & returns">
              <p>
                {product.shipping
                  ? `Free ${product.shipping.method} delivery: ${product.shipping.etaDays} days${product.shipping.tracking ? ', tracked' : ''}.`
                  : `${DELIVERY.standard.label} delivery is free: ${DELIVERY.standard.detail.toLowerCase()}.`}{' '}
                We deliver within the United States only.
              </p>
              <p>
                {facts?.shipsFrom ? `This piece ships from ${facts.shipsFrom}. ` : ''}Return anything unworn within {RETURN_WINDOW_DAYS} days of delivery, free.{' '}
                <Link href="/help/returns" className="underline underline-offset-4">How returns work</Link>
              </p>
            </Accordion>
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="mt-20 md:mt-28" aria-label="Complete the look">
          <div className="[&_h2]:text-[30px] md:[&_h2]:text-[40px]">
            <SectionHeading title="Complete the look" link={{ label: `Shop all ${deptName}`, href: `/shop/${dept}` }} />
          </div>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
            {related.slice(0, 4).map((p) => (
              <li key={p.id} className="w-[42%] shrink-0 snap-start md:w-auto">
                <ProductCard product={productToCard(p, now)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {product.reviews?.length ? (
        <section className="mt-20 md:mt-28" aria-label="Customer reviews">
          <div className="[&_h2]:text-[30px] md:[&_h2]:text-[40px]">
            <SectionHeading title="What buyers say" />
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {product.reviews.map((review, i) => (
              <li key={i} className="border border-line px-6 py-5">
                <p className="text-sm tracking-wide" aria-label={`${review.stars} out of 5 stars`}>
                  {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed">{review.text}</p>
                {(review.origin || review.size) && (
                  <p className="mt-3 text-xs text-muted">
                    Verified buyer
                    {review.size ? ` · Size ${review.size}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

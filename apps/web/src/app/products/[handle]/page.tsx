import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CareTag } from '@/components/CareTag';
import { SizeGuide } from '@/components/SizeGuide';
import { VariantPicker } from '@/components/VariantPicker';
import { arrivalLabel, DEPARTMENTS, liveProducts, priceLabel, productByHandle } from '@/lib/catalog';

export const revalidate = 300;

export async function generateStaticParams() {
  return (await liveProducts()).map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const p = await productByHandle((await params).handle);
  if (!p) return {};
  return {
    title: { absolute: p.seo.title },
    description: p.seo.metaDescription,
    alternates: { canonical: `/products/${p.handle}` },
    openGraph: { title: p.seo.title, description: p.seo.metaDescription, images: p.images.slice(0, 1).map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const p = await productByHandle((await params).handle);
  if (!p) notFound();

  const arrival = arrivalLabel(p.delivery);
  const knowBefore = p.bullets.filter((b) => /decorative|runs|size (up|down)|inseam|shorter|longer|thin|lightweight|brighter|darker/i.test(b));
  const tag = [
    { term: 'Ships from', detail: 'A US warehouse' },
    ...(arrival ? [{ term: 'Delivery', detail: `${arrival.replace('Arrives in ', '')}, ${p.freeShipping ? 'shipping included' : 'shipping at checkout'}` }] : []),
    ...(p.sizeChart?.fitNotes[0] ? [{ term: 'Fit', detail: p.sizeChart.fitNotes[0] }] : []),
    ...knowBefore.filter((b) => b !== p.sizeChart?.fitNotes[0]).slice(0, 3).map((b, i) => ({ term: i === 0 ? 'Good to know' : '', detail: b })),
    ...(p.material ? [{ term: 'Material', detail: p.material }] : []),
    { term: 'Made', detail: 'Imported' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    name: p.title,
    description: p.seo.metaDescription,
    image: p.images.map((i) => i.url),
    url: `${process.env.SITE_URL ?? ''}/products/${p.handle}`,
    variesBy: ['https://schema.org/size', 'https://schema.org/color'],
    hasVariant: p.variants.map((v) => ({
      '@type': 'Product',
      sku: v.id,
      name: `${p.title}, ${v.color}, ${v.size}`,
      size: v.size,
      color: v.color,
      ...(p.material ? { material: p.material } : {}),
      offers: {
        '@type': 'Offer',
        price: (v.priceCents / 100).toFixed(2),
        priceCurrency: 'USD',
        availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        shippingDetails: p.delivery.maxDays
          ? {
              '@type': 'OfferShippingDetails',
              shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
              shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                transitTime: { '@type': 'QuantitativeValue', minValue: p.delivery.minDays, maxValue: p.delivery.maxDays, unitCode: 'DAY' },
              },
            }
          : undefined,
      },
    })),
  };

  return (
    <article className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href={`/${p.department}`} className="hover:text-denim">{DEPARTMENTS[p.department]}</Link>
      </nav>

      <div className="mt-4 grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          {p.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0].url} alt={p.images[0].alt} className="aspect-[4/5] w-full rounded-md bg-mist object-cover" />
          )}
          {p.images.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {p.images.slice(1, 7).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.url} src={img.url} alt={img.alt} loading="lazy" className="aspect-square w-full rounded-md bg-mist object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="display text-[clamp(2.4rem,5vw,3.5rem)]">{p.title}</h1>
            <p className="mt-3 text-lg">{priceLabel(p)}</p>
          </div>
          <VariantPicker variants={p.variants} colors={p.colors} sizes={p.sizes} />
          {p.sizeChart && (
            <a href="#size" className="inline-block font-semibold text-denim underline underline-offset-4">
              See the size guide
            </a>
          )}
          <CareTag title="Before you buy" lines={tag} />
        </div>
      </div>

      <div className="mt-20 grid gap-16 md:grid-cols-[1fr_1fr]">
        <section aria-labelledby="details">
          <h2 id="details" className="display text-4xl">Details</h2>
          <ul className="mt-4 list-disc space-y-1.5 pl-5">
            {p.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-6 max-w-prose space-y-4 text-ink-soft">
            {p.description.map((d) => (
              <p key={d}>{d}</p>
            ))}
          </div>
        </section>
        {p.faq.length > 0 && (
          <section aria-labelledby="questions">
            <h2 id="questions" className="display text-4xl">Questions</h2>
            <div className="mt-4 divide-y divide-mist border-y border-mist">
              {p.faq.map((f) => (
                <details key={f.q} className="group py-3">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="mr-2 inline-block text-denim transition-transform group-open:rotate-45" aria-hidden>+</span>
                    {f.q}
                  </summary>
                  <p className="mt-2 pl-6 text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {p.sizeChart && (
        <div className="mt-20">
          <SizeGuide chart={p.sizeChart} />
        </div>
      )}
    </article>
  );
}

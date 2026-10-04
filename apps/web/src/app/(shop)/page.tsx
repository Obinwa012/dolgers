import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Category } from '@dolgers/shared';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { NewsletterForm } from '@/components/home/NewsletterForm';
import { ProductCard } from '@/components/ProductCard';
import { ProductImage, isDarkTone } from '@/components/ProductImage';
import { SectionHeading } from '@/components/ui';
import { nowMs, productToCard } from '@/components/shop/cards';
import { getCategories, getHome, getNewArrivals, getProductsByIds, getVendors } from '@/lib/server/catalog';

// The homepage shows live new arrivals: always render from Firestore, never a stale build.
export const dynamic = 'force-dynamic';

const FOUNDATIONS: { id: string; shot: string }[] = [
  { id: 'men--outerwear', shot: 'Wool overcoat on rail' },
  { id: 'men--knitwear', shot: 'Folded merino knits' },
  { id: 'men--denim-trousers', shot: 'Selvedge denim detail' },
  { id: 'men--shoes', shot: 'Leather boots' },
];

// Each maker's name set in its own voice, as in the mockup's makers strip.
const WORDMARK_STYLES = [
  'font-sans text-[15px] font-semibold uppercase tracking-[0.3em]',
  'display text-[24px] italic',
  'font-sans text-[13px] font-medium uppercase tracking-[0.4em]',
  'display text-[22px] tracking-[0.04em]',
  'font-sans text-[20px] font-light italic',
  'display text-[18px] uppercase tracking-[0.3em]',
];

export default async function HomePage() {
  const [home, categories, newArrivals, vendors] = await Promise.all([getHome(), getCategories(), getNewArrivals(8), getVendors()]);
  const editProducts = await getProductsByIds(home.edit.productIds);
  const now = nowMs();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const tiles = FOUNDATIONS.map((f) => ({ ...f, category: byId.get(f.id) })).filter((t): t is { id: string; shot: string; category: Category } => !!t.category);

  return (
    <>
      <HeroCarousel slides={[home.hero, ...(home.heroSlides ?? [])]} />

      {/* Shop by category */}
      {tiles.length ? (
        <section className="container-page mt-20 md:mt-28">
          <SectionHeading eyebrow="Shop by category" title="Wardrobe foundations" link={{ label: 'View all', href: '/shop/men' }} />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-4">
            {tiles.map(({ category, shot }) => (
              <li key={category.id}>
                <Link href={`/shop/${category.path.join('/')}`} className="group block">
                  <ProductImage
                    image={category.image ?? { url: '', alt: shot, tone: category.tone ?? 'stone' }}
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="aspect-[3/4] w-full"
                  />
                  <span className="mt-4 flex items-center justify-between">
                    <span className="display text-[20px] md:text-[24px]">{category.name}</span>
                    <ArrowRight size={16} strokeWidth={1.25} aria-hidden className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Men / Boys */}
      {home.departments.length ? (
        <section className="container-page mt-20 grid gap-3 md:mt-28 md:grid-cols-2 md:gap-4" aria-label="Departments">
          {home.departments.map((d) => {
            const dark = !!d.image?.url || isDarkTone(d.image?.tone);
            return (
              <Link key={d.title} href={d.cta.href} className={`group relative block ${dark ? 'text-white' : 'text-ink'}`}>
                <ProductImage image={d.image} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] w-full md:aspect-[5/6]" showLabel={false} />
                {d.image?.url ? <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden /> : null}
                {!d.image?.url && d.image?.alt ? (
                  <span className={`absolute left-4 top-4 text-[9px] uppercase tracking-[0.16em] md:left-8 md:top-6 ${dark ? 'text-white/45' : 'text-black/35'}`}>[Image] {d.image.alt}</span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 p-6 md:p-10">
                  <span className="display block text-[56px] md:text-[72px]">{d.title}</span>
                  <span className={`mt-3 block max-w-sm text-sm leading-relaxed ${dark ? 'text-white/75' : 'text-muted'}`}>{d.body}</span>
                  <span className="link-underline mt-6 inline-block">{d.cta.label}</span>
                </span>
              </Link>
            );
          })}
        </section>
      ) : null}

      {/* New arrivals */}
      {newArrivals.length ? (
        <section className="container-page mt-20 md:mt-28">
          <SectionHeading eyebrow="Just landed" title="New Arrivals" link={{ label: 'Shop new in', href: '/new-in' }} />
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
            {newArrivals.slice(0, 4).map((p) => (
              <li key={p.id} className="w-[44%] shrink-0 snap-start md:w-auto">
                <ProductCard product={productToCard(p, now)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The shoe edit */}
      <section className="container-page mt-20 grid items-center gap-10 md:mt-28 md:grid-cols-2 md:gap-16">
        <ProductImage image={home.edit.image} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] w-full" />
        <div className="max-w-lg">
          {home.edit.eyebrow ? <p className="label text-muted">{home.edit.eyebrow}</p> : null}
          <h2 className="display mt-4 text-[40px] md:text-[56px]">{home.edit.title}</h2>
          {home.edit.body ? <p className="mt-5 text-[15px] leading-relaxed text-muted">{home.edit.body}</p> : null}
          {home.edit.cta.label ? <Link href={home.edit.cta.href} className="btn btn-primary mt-8">{home.edit.cta.label}</Link> : null}
          {editProducts.length ? (
            <ul className="mt-12 grid grid-cols-2 gap-4">
              {editProducts.slice(0, 2).map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.slug}`} className="group block">
                    <ProductImage image={p.images[0]} sizes="(min-width: 768px) 20vw, 45vw" className="aspect-square w-full" />
                    <span className="mt-3 block text-[13px] group-hover:underline group-hover:underline-offset-4">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Our makers */}
      {vendors.length ? (
        <section className="mt-20 border-y border-line py-16 text-center md:mt-28 md:py-20">
          <div className="container-page">
            <p className="label text-muted">Our makers</p>
            <h2 className="display mt-4 text-[32px] md:text-[44px]">Independent labels, one address</h2>
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:mt-12 md:justify-between">
              {vendors.map((v, i) => (
                <li key={v.id}>
                  <Link href={`/brands/${v.slug}`} className={`${WORDMARK_STYLES[i % WORDMARK_STYLES.length]} transition-opacity hover:opacity-60`}>
                    {v.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/sell" className="link-underline mt-12 inline-block">Are you a label? Sell with us</Link>
          </div>
        </section>
      ) : null}

      {/* Join the list */}
      <section className="-mb-24 mt-20 bg-ink text-white md:mt-28" aria-labelledby="join-the-list">
        <div className="container-page grid gap-10 py-16 md:grid-cols-2 md:items-center md:gap-16 md:py-20">
          <div>
            <h2 id="join-the-list" className="display text-[40px] md:text-[52px]">Join the list</h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">Early access to new collections, maker stories and private sales. No noise.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}

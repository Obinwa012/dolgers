import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { ProductImage, isDarkTone } from '@/components/ProductImage';
import { docToCard } from '@/components/shop/cards';
import { FollowButton } from '@/components/shop/FollowButton';
import { loadListing } from '@/components/shop/listing-data';
import { Pagination } from '@/components/shop/Pagination';
import { Paragraphs } from '@/components/shop/Paragraphs';
import { listingHref } from '@/components/shop/query';
import { SortSelect } from '@/components/shop/SortSelect';
import { getVendor } from '@/lib/server/catalog';

export async function generateMetadata({ params }: PageProps<'/brands/[slug]'>): Promise<Metadata> {
  const vendor = await getVendor((await params).slug);
  if (!vendor) return { title: 'Not found' };
  return {
    title: vendor.name,
    description: vendor.tagline,
    alternates: { canonical: `/brands/${vendor.slug}` },
    openGraph: { title: vendor.name, description: vendor.tagline, images: vendor.banner?.url ? [{ url: vendor.banner.url, alt: vendor.banner.alt }] : undefined },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps<'/brands/[slug]'>) {
  const vendor = await getVendor((await params).slug);
  if (!vendor) notFound();
  const sp = await searchParams;
  const deptParam = Array.isArray(sp.dept) ? sp.dept[0] : sp.dept;
  const dept = deptParam === 'men' || deptParam === 'boys' ? deptParam : null;
  const pathname = `/brands/${vendor.slug}`;
  const { state, result } = await loadListing({ sort: sp.sort, page: sp.page, dept: sp.dept }, { vendorId: vendor.id, department: dept, perPage: 48 }, ['dept']);

  const banner = vendor.banner ?? { url: '', alt: `${vendor.name} workshop`, tone: 'charcoal' };
  const darkBanner = !!banner.url || isDarkTone(banner.tone);
  const text = darkBanner ? 'text-white' : 'text-ink';
  const tabs = [
    { label: 'All', value: '' },
    ...(['men', 'boys'] as const).filter((d) => vendor.departments.includes(d)).map((d) => ({ label: d === 'men' ? 'Men' : 'Boys', value: d })),
  ];
  const f = vendor.facts;
  const ships = f.shipsFrom
    ? `${f.shipsFrom}${f.dispatchDays ? `, in ${f.dispatchDays[0] === f.dispatchDays[1] ? f.dispatchDays[0] : `${f.dispatchDays[0]}–${f.dispatchDays[1]}`} working days` : ''}`
    : null;
  const facts = [
    ['Founded', f.founded],
    ['Based in', f.basedIn],
    ['Made in', f.madeIn],
    ['Ships from', ships],
  ].filter((x): x is [string, string] => !!x[1]);
  const pages = Math.max(1, Math.ceil(result.found / result.perPage));

  return (
    <div>
      <section className={`relative ${text}`}>
        <div className="absolute inset-0">
          <ProductImage image={banner} sizes="100vw" priority showLabel={false} className="h-full w-full"
        />
        </div>
        {banner.url ? <div className="absolute inset-0 bg-black/45" aria-hidden /> : null}
        <div className="container-page relative pb-10 pt-24 md:pb-12 md:pt-32">
          <nav aria-label="Breadcrumb" className={`text-xs ${darkBanner ? 'text-white/70' : 'text-muted'}`}>
            <ol className="flex flex-wrap gap-2">
              <li><Link href="/" className="hover:underline">Home</Link></li>
              <li aria-hidden>/</li>
              <li><Link href="/brands" className="hover:underline">Brands</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page" className={darkBanner ? 'text-white' : 'text-ink'}>{vendor.name}</li>
            </ol>
          </nav>
          <h1 className="mt-5 break-words text-[44px] font-medium uppercase leading-none tracking-[0.14em] sm:text-[64px] md:text-[96px]">{vendor.name}</h1>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className={`max-w-lg text-[15px] leading-relaxed ${darkBanner ? 'text-white/80' : 'text-muted'}`}>{vendor.tagline}</p>
            <div className="flex flex-wrap gap-2">
              <FollowButton vendorId={vendor.id} vendorSlug={vendor.slug} onDark={darkBanner} />
              <a href="#about" className={`btn ${darkBanner ? 'btn-outline-light' : 'btn-secondary'}`}>About the maker</a>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page">
        <div className="flex flex-col gap-4 border-b border-line py-3 sm:flex-row sm:items-center sm:justify-between">
          {tabs.length > 2 ? (
            <nav aria-label="Department">
              <ul className="flex gap-6">
                {tabs.map((t) => {
                  const active = (dept ?? '') === t.value;
                  return (
                    <li key={t.label}>
                      <Link
                        href={listingHref(pathname, state, { keep: { dept: t.value } })}
                        aria-current={active ? 'page' : undefined}
                        className={`label inline-block py-2 ${active ? 'border-b border-ink' : 'text-muted hover:text-ink'}`}
                      >
                        {t.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : <span />}
          <div className="flex items-center justify-between gap-6">
            <p className="text-xs text-muted">{result.found} {result.found === 1 ? 'piece' : 'pieces'}</p>
            <SortSelect pathname={pathname} state={state} id="brand-sort" />
          </div>
        </div>

        {result.hits.length ? (
          <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4">
            {result.hits.map((hit) => (
              <li key={hit.id}>
                <ProductCard product={docToCard(hit, hit.department === 'boys' ? 'Boys' : 'Men')} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-muted">{vendor.name} has nothing listed here right now. Follow them to hear about new pieces.</p>
        )}
        {pages > 1 ? <Pagination pathname={pathname} state={state} pages={pages} /> : null}

        <section id="about" className="mt-20 grid scroll-mt-28 items-center gap-10 md:mt-28 md:grid-cols-2 md:gap-16" aria-label={`About ${vendor.name}`}>
          <ProductImage image={vendor.storyImage ?? { url: '', alt: `The ${vendor.name} workshop`, tone: 'stone' }} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-square w-full" />
          <div className="max-w-md">
            <p className="label text-muted">About the maker</p>
            <h2 className="display mt-4 text-[36px] md:text-[48px]">{vendor.storyTitle || vendor.name}</h2>
            <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-muted">
              <Paragraphs text={vendor.story} />
            </div>
            {facts.length ? (
              <dl className="mt-8 grid grid-cols-2 gap-x-6">
                {facts.map(([k, v]) => (
                  <div key={k} className="border-t border-line py-4">
                    <dt className="label">{k}</dt>
                    <dd className="mt-1.5 text-[13px] text-ink-2">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

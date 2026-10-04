import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { Breadcrumbs } from '@/components/ui';
import { getVendors } from '@/lib/server/catalog';

export const metadata: Metadata = {
  title: 'Our makers',
  description: 'The independent labels on DOLGERS: who they are, where they work and what they make.',
  alternates: { canonical: '/brands' },
};

export default async function BrandsPage() {
  const vendors = await getVendors();
  return (
    <div className="container-page pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Brands' }]} />
      <div className="mt-6 max-w-2xl md:mt-8">
        <p className="label text-muted">Our makers</p>
        <h1 className="display mt-3 text-[44px] md:text-[64px]">Independent labels, one address</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Every label here designs its own pieces, makes them in small runs and ships them to you directly. Follow the ones you like to hear when
          they release something new.
        </p>
      </div>
      <ul className="mt-12 grid gap-x-4 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <li key={v.id}>
            <Link href={`/brands/${v.slug}`} className="group block">
              <ProductImage image={v.banner ?? { url: '', alt: `${v.name} workshop`, tone: 'stone' }} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="aspect-[4/3] w-full" />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h2 className="display text-[28px] group-hover:underline group-hover:underline-offset-4">{v.name}</h2>
                <span className="label shrink-0 text-muted">{v.departments.map((d) => (d === 'men' ? 'Men' : 'Boys')).join(' · ')}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.tagline}</p>
              {v.facts.basedIn ? <p className="mt-2 text-xs text-faint">{v.facts.basedIn}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-20 border-t border-line pt-10 text-center">
        <p className="display text-3xl">Are you a label?</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">We are always looking for makers who build clothes to last.</p>
        <Link href="/sell" className="btn btn-secondary mt-6">Sell with us</Link>
      </div>
    </div>
  );
}

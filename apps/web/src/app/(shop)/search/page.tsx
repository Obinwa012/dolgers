import type { Metadata } from 'next';
import { DepartmentListing } from '@/components/shop/DepartmentListing';
import { SearchBox } from '@/components/shop/SearchBox';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams;
  const q = String((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '').trim().slice(0, 100);
  return (
    <>
      <div className="container-page pt-8">
        <SearchBox initial={q} />
      </div>
      <DepartmentListing
        searchParams={sp}
        pathname="/search"
        title={q ? `“${q}”` : 'Search'}
        description={q ? undefined : 'Search by product, maker, category or colour.'}
        base={{}}
        keep={['q']}
        emptyMessage={q ? `No results for “${q}”.` : 'Nothing found.'}
      />
    </>
  );
}

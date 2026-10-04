import type { SearchQuery } from '@dolgers/shared';
import { loadListing } from './listing-data';
import { listingHref } from './query';
import { ShopListing } from './ShopListing';

type Params = Record<string, string | string[] | undefined>;

/**
 * A listing that spans both departments (New in, Shoes, Accessories, Search), with an
 * All / Men / Boys switch kept in the URL as ?dept=.
 */
export async function DepartmentListing({
  searchParams,
  pathname,
  title,
  description,
  base,
  keep = [],
  emptyMessage,
}: {
  searchParams: Params;
  pathname: string;
  title: string;
  description?: string;
  base: Partial<SearchQuery>;
  keep?: string[];
  emptyMessage?: string;
}) {
  const deptParam = Array.isArray(searchParams.dept) ? searchParams.dept[0] : searchParams.dept;
  const dept = deptParam === 'men' || deptParam === 'boys' ? deptParam : null;
  const { state, result } = await loadListing(searchParams, { ...base, department: dept }, ['dept', ...keep]);
  const chips = [
    { label: 'All', value: '' },
    { label: 'Men', value: 'men' },
    { label: 'Boys', value: 'boys' },
  ].map((c) => ({ label: c.label, href: listingHref(pathname, state, { keep: { dept: c.value } }), active: (dept ?? '') === c.value }));

  return (
    <ShopListing
      pathname={pathname}
      state={state}
      result={result}
      title={title}
      description={description}
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: title }]}
      chips={chips}
      emptyMessage={emptyMessage}
    />
  );
}

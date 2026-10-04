import Link from 'next/link';
import { COLOURS, type SearchResult } from '@dolgers/shared';
import { ProductCard } from '@/components/ProductCard';
import { Breadcrumbs } from '@/components/ui';
import { docToCard } from './cards';
import { FilterDrawer } from './FilterDrawer';
import { FilterPanel, type FilterOptions } from './FilterPanel';
import { Pagination } from './Pagination';
import { activeFilterCount, listingHref, sortSizes, type ListingState } from './query';
import { SortSelect } from './SortSelect';

export interface Chip {
  label: string;
  href: string;
  active: boolean;
}

/** Facet values plus any selected value the current results no longer contain, so it can be unticked. */
function withSelected(facets: { value: string; count: number }[], selected: string[]) {
  const out = [...facets];
  for (const v of selected) if (!out.some((f) => f.value === v)) out.push({ value: v, count: 0 });
  return out;
}

export function filterOptions(result: SearchResult, state: ListingState): FilterOptions {
  const hexFromHits = new Map(result.hits.map((h) => [h.colour, h.colourHex]));
  const sizes = withSelected(result.facets.sizes, state.sizes);
  const sizeOrder = sortSizes(sizes.map((s) => s.value));
  const colourRank = (name: string) => {
    const i = COLOURS.findIndex((c) => c.name === name);
    return i === -1 ? COLOURS.length : i;
  };
  return {
    sizes: sizeOrder.map((v) => sizes.find((s) => s.value === v)!),
    colours: withSelected(result.facets.colours, state.colours)
      .sort((a, b) => colourRank(a.value) - colourRank(b.value) || a.value.localeCompare(b.value))
      .map((c) => ({ ...c, hex: COLOURS.find((x) => x.name === c.value)?.hex ?? hexFromHits.get(c.value) ?? '#cccccc' })),
    brands: withSelected(result.facets.vendors, state.brands).sort((a, b) => a.value.localeCompare(b.value)),
  };
}

/**
 * The product listing used by category, new-in, shoes, accessories and search pages (mockup
 * frame 02): heading, department switch, sub-category chips, count + sort, filter sidebar (a
 * drawer on mobile), product grid and pagination.
 */
export function ShopListing({
  pathname,
  state,
  result,
  title,
  description,
  breadcrumbs,
  departments,
  chips,
  emptyMessage = 'Nothing matches these filters yet.',
}: {
  pathname: string;
  state: ListingState;
  result: SearchResult;
  title: string;
  description?: string;
  breadcrumbs: { label: string; href?: string }[];
  departments?: Chip[];
  chips?: Chip[];
  emptyMessage?: string;
}) {
  const options = filterOptions(result, state);
  const active = activeFilterCount(state);
  const panelKey = `${state.min}|${state.max}`;
  const countLabel = `${result.found} ${result.found === 1 ? 'item' : 'items'}`;
  const pages = Math.max(1, Math.ceil(result.found / result.perPage));

  return (
    <div className="container-page pb-8 pt-6 md:pt-8">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-4 flex flex-col gap-5 md:mt-8 md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="max-w-2xl">
          <h1 className="display text-[44px] md:text-[64px]">{title}</h1>
          {description ? <p className="mt-3 text-[15px] leading-relaxed text-muted md:mt-4">{description}</p> : null}
        </div>
        {departments?.length ? (
          <nav aria-label="Department" className="grid shrink-0 grid-cols-2 border border-ink md:w-[204px]">
            {departments.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={d.active ? 'page' : undefined}
                className={`label flex h-12 items-center justify-center md:h-11 ${d.active ? 'bg-ink text-white' : 'hover:bg-stone'}`}
              >
                {d.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-6 md:mt-8 md:border-y md:border-line md:py-3">
        {chips?.length ? (
          <nav aria-label="Categories" className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 md:mx-0 md:px-0">
            <ul className="flex gap-2 whitespace-nowrap">
              {chips.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    aria-current={c.active ? 'page' : undefined}
                    className={`inline-flex h-10 items-center border px-5 text-[13px] ${c.active ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink'}`}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : <span className="hidden md:block" />}
        <div className="hidden shrink-0 items-center gap-6 md:flex">
          <p className="text-xs text-muted" aria-live="polite">{countLabel}</p>
          <SortSelect pathname={pathname} state={state} id="sort-desktop" />
        </div>
      </div>

      {/* Mobile: filter + sort bar */}
      <div className="-mx-4 mt-5 grid grid-cols-2 border-y border-line md:hidden">
        <div className="border-r border-line">
          <FilterDrawer key={panelKey} pathname={pathname} state={state} options={options} found={result.found} activeCount={active} />
        </div>
        <SortSelect pathname={pathname} state={state} id="sort-mobile" compact />
      </div>
      <p className="mt-4 text-xs text-muted md:hidden">{countLabel}</p>

      <div className="mt-4 grid gap-10 md:mt-8 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="hidden md:block" aria-label="Filters">
          <FilterPanel key={panelKey} pathname={pathname} state={state} options={options} idPrefix="side" />
        </aside>

        <section aria-label="Products">
          {result.hits.length ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 lg:grid-cols-3 xl:grid-cols-4">
              {result.hits.map((hit, i) => (
                <li key={hit.id}>
                  <ProductCard product={docToCard(hit)} priority={i < 4} sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, 45vw" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border border-line px-6 py-16 text-center">
              <p className="display text-3xl">{emptyMessage}</p>
              {active ? (
                <Link href={listingHref(pathname, state, { sizes: [], colours: [], brands: [], min: '', max: '' })} className="link-underline mt-6 inline-block">
                  Clear filters
                </Link>
              ) : (
                <Link href="/new-in" className="link-underline mt-6 inline-block">See what&rsquo;s new</Link>
              )}
            </div>
          )}
          {pages > 1 ? <Pagination pathname={pathname} state={state} pages={pages} /> : null}
        </section>
      </div>
    </div>
  );
}

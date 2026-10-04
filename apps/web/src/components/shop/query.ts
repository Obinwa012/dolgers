import { SIZE_LABELS, SORTS, type SortKey } from '@dolgers/shared';

/** The filter state a listing keeps in its URL: ?size=M,L&colour=Black&brand=Nordhavn&min=0&max=600&sort=newest&page=2 */
export interface ListingState {
  sizes: string[];
  colours: string[];
  brands: string[];
  /** Whole dollars as typed by the shopper. */
  min: string;
  max: string;
  sort: SortKey;
  page: number;
  /** Extra params a page keeps (search text, department tab). */
  keep: Record<string, string>;
}

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function list(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? v.split(',') : []).map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

export function readListingState(sp: Params, keepKeys: string[] = []): ListingState {
  const sort = first(sp.sort);
  const page = Number(first(sp.page));
  const dollars = (v: string) => (/^\d{1,6}(\.\d{0,2})?$/.test(v) ? v : '');
  const keep: Record<string, string> = {};
  for (const k of keepKeys) {
    const v = first(sp[k]).slice(0, 100);
    if (v) keep[k] = v;
  }
  return {
    sizes: list(sp.size),
    colours: list(sp.colour),
    brands: list(sp.brand),
    min: dollars(first(sp.min)),
    max: dollars(first(sp.max)),
    sort: sort in SORTS ? (sort as SortKey) : 'featured',
    page: Number.isInteger(page) && page > 0 && page < 100 ? page : 1,
    keep,
  };
}

/** Builds a listing URL from a state plus changes. Any filter change resets to page 1. */
export function listingHref(pathname: string, state: ListingState, patch: Partial<ListingState> = {}): string {
  const s = { ...state, ...patch, keep: { ...state.keep, ...patch.keep } };
  if (!('page' in patch)) s.page = 1;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s.keep)) if (v) p.set(k, v);
  if (s.sizes.length) p.set('size', s.sizes.join(','));
  if (s.colours.length) p.set('colour', s.colours.join(','));
  if (s.brands.length) p.set('brand', s.brands.join(','));
  if (s.min) p.set('min', s.min);
  if (s.max) p.set('max', s.max);
  if (s.sort !== 'featured') p.set('sort', s.sort);
  if (s.page > 1) p.set('page', String(s.page));
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function activeFilterCount(s: ListingState): number {
  return s.sizes.length + s.colours.length + s.brands.length + (s.min ? 1 : 0) + (s.max ? 1 : 0);
}

const SIZE_ORDER = Object.values(SIZE_LABELS).flat();

/** Sizes in the order shoppers expect: XS..XXL, then shoe, age and waist sizes. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s);
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

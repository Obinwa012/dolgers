import 'server-only';
import type { SearchQuery, SearchResult } from '@dolgers/shared';
import { parseSearchParams, searchProducts } from '@/lib/server/search';
import { readListingState, type ListingState } from './query';

type Params = Record<string, string | string[] | undefined>;

/** Reads the URL filters, runs the search and returns both for <ShopListing>. */
export async function loadListing(sp: Params, base: Partial<SearchQuery>, keepKeys: string[] = []): Promise<{ state: ListingState; result: SearchResult }> {
  const state = readListingState(sp, keepKeys);
  const result = await searchProducts(parseSearchParams(sp, base));
  return { state, result };
}

export const DEPARTMENT_LABEL: Record<string, string> = { men: 'Men', boys: 'Boys' };

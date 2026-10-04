'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SORTS, type SortKey } from '@dolgers/shared';
import { listingHref, type ListingState } from './query';

export function SortSelect({ pathname, state, id, compact = false }: { pathname: string; state: ListingState; id: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={`flex items-center gap-3 ${compact ? 'h-12 w-full min-w-0' : ''}`}>
      <label htmlFor={id} className={compact ? 'sr-only' : 'label'}>Sort</label>
      <div className={`relative ${compact ? 'w-full min-w-0' : ''}`}>
        <select
          id={id}
          value={state.sort}
          aria-busy={pending}
          onChange={(e) => startTransition(() => router.push(listingHref(pathname, state, { sort: e.target.value as SortKey }), { scroll: false }))}
          className={
            compact
              ? 'label h-12 w-full cursor-pointer appearance-none truncate bg-transparent pl-3 pr-8 text-center [text-align-last:center]'
              : 'h-10 min-w-[170px] cursor-pointer appearance-none border border-line-strong bg-paper pl-3 pr-9 text-[13px]'
          }
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>{compact ? `Sort: ${label}` : label}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

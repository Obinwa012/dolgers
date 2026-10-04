import Link from 'next/link';
import { listingHref, type ListingState } from './query';

export function Pagination({ pathname, state, pages }: { pathname: string; state: ListingState; pages: number }) {
  const current = Math.min(state.page, pages);
  const nums = [...new Set([1, current - 1, current, current + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const href = (page: number) => listingHref(pathname, state, { page });
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      {current > 1 ? <Link href={href(current - 1)} className="label px-3 py-2 hover:opacity-60" rel="prev">Previous</Link> : null}
      <ul className="flex items-center gap-1">
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 ? <span aria-hidden className="px-1 text-faint">…</span> : null}
            <Link
              href={href(n)}
              aria-current={n === current ? 'page' : undefined}
              aria-label={`Page ${n}`}
              className={`flex h-10 min-w-10 items-center justify-center border text-[13px] ${n === current ? 'border-ink bg-ink text-white' : 'border-transparent hover:border-line-strong'}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ul>
      {current < pages ? <Link href={href(current + 1)} className="label px-3 py-2 hover:opacity-60" rel="next">Next</Link> : null}
    </nav>
  );
}

'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="flex items-center gap-3 border-b border-ink pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `/search?q=${encodeURIComponent(v)}` : '/search');
      }}
    >
      <Search size={18} strokeWidth={1.5} className="text-muted" aria-hidden />
      <label htmlFor="search-page-q" className="sr-only">Search the store</label>
      <input
        id="search-page-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search coats, knitwear, makers…"
        maxLength={100}
        className="w-full bg-transparent py-2 text-lg outline-none"
      />
      <button type="submit" className="label shrink-0">Search</button>
    </form>
  );
}

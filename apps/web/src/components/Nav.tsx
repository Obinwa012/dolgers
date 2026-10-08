'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/run', label: 'Import & vet' },
  { href: '/products', label: 'Products' },
  { href: '/queue', label: 'Queue' },
  { href: '/sellers', label: 'Sellers' },
  { href: '/database', label: 'Database' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${active ? 'bg-paper/10 text-paper' : 'text-paper/65 hover:bg-paper/5 hover:text-paper'}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

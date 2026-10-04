'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useBag } from '@/context/BagProvider';
import { Logo } from './Logo';

export function HeaderBar({ nav }: { nav: { label: string; href: string }[] }) {
  const { count, hydrated } = useBag();
  const { isMember, claims } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close overlays on navigation
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  const accountHref = isMember ? '/account' : '/sign-in';
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="border-b border-line">
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <div className="flex items-center gap-3 lg:w-[220px]">
          <button type="button" className="-ml-2 p-2 lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <Logo />
        </div>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`label py-2 transition-opacity hover:opacity-60 ${active(item.href) ? 'border-b border-ink' : ''}`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-1 lg:w-[220px]">
          <button type="button" className="p-2" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
            <Search size={18} strokeWidth={1.5} />
          </button>
          <Link href={accountHref} className="hidden p-2 sm:block" aria-label="Account">
            <User size={18} strokeWidth={1.5} />
          </Link>
          <Link href="/wishlist" className="hidden p-2 sm:block" aria-label="Wishlist">
            <Heart size={18} strokeWidth={1.5} />
          </Link>
          <Link href="/bag" className="relative p-2" aria-label={`Bag, ${count} items`}>
            <ShoppingBag size={18} strokeWidth={1.5} />
            {hydrated && count > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-medium text-white">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-line bg-paper">
          <form
            role="search"
            className="container-page flex items-center gap-3 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search size={18} strokeWidth={1.5} className="text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search coats, knitwear, makers…"
              aria-label="Search the store"
              className="w-full bg-transparent py-2 text-base outline-none"
              maxLength={100}
            />
            <button type="submit" className="label">Search</button>
          </form>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button type="button" aria-label="Close menu" className="p-2" onClick={() => setMenuOpen(false)}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-4">
              <ul>
                {nav.map((item) => (
                  <li key={item.href} className="border-b border-line">
                    <Link href={item.href} className="block py-4 text-[13px] font-medium uppercase tracking-[0.16em]">{item.label}</Link>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 space-y-3 text-sm text-muted">
                <li><Link href={accountHref}>{isMember ? 'My account' : 'Sign in'}</Link></li>
                <li><Link href="/wishlist">Wishlist</Link></li>
                {claims.vendorId ? <li><Link href="/vendor">Vendor dashboard</Link></li> : <li><Link href="/sell">Sell with us</Link></li>}
                {claims.admin ? <li><Link href="/admin">Admin</Link></li> : null}
                <li><Link href="/help/contact">Help</Link></li>
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}

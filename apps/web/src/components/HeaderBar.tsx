'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useBag } from '@/context/BagProvider';
import { Logo } from './Logo';

export function HeaderBar({ nav, announcements }: { nav: { label: string; href: string }[]; announcements: string[] }) {
  const { count, hydrated } = useBag();
  const { isMember, claims } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [announcementPaused, setAnnouncementPaused] = useState(false);
  const [q, setQ] = useState('');
  const messages = announcements.map((message) => message.trim()).filter(Boolean);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close overlays on navigation
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    if (messages.length < 2 || announcementPaused) return;
    const timer = window.setInterval(() => {
      setAnnouncementIndex((index) => (index + 1) % messages.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [announcementPaused, messages.length]);

  const accountHref = isMember ? '/account' : '/sign-in';
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      setSearchOpen(false);
    }
  };
  const moveAnnouncement = (offset: number) => {
    setAnnouncementIndex((index) => (index + offset + messages.length) % messages.length);
  };

  return (
    <>
      {messages.length > 0 ? (
        <div
          className="announcement-bar"
          role="region"
          aria-label="Store announcements"
          onMouseEnter={() => setAnnouncementPaused(true)}
          onMouseLeave={() => setAnnouncementPaused(false)}
          onFocus={() => setAnnouncementPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setAnnouncementPaused(false);
          }}
        >
          <div className="announcement-inner">
            {messages.length > 1 ? (
              <button type="button" className="announcement-arrow" aria-label="Previous announcement" onClick={() => moveAnnouncement(-1)}>
                <ChevronLeft size={18} strokeWidth={2} />
              </button>
            ) : <span className="announcement-arrow-spacer" aria-hidden="true" />}
            <p className="announcement-copy" aria-live="polite" aria-atomic="true" key={announcementIndex}>
              <span>{messages[announcementIndex % messages.length]}</span>
              <Link href="/help/delivery" className="announcement-detail">Details</Link>
            </p>
            {messages.length > 1 ? (
              <button type="button" className="announcement-arrow" aria-label="Next announcement" onClick={() => moveAnnouncement(1)}>
                <ChevronRight size={18} strokeWidth={2} />
              </button>
            ) : <span className="announcement-arrow-spacer" aria-hidden="true" />}
          </div>
        </div>
      ) : null}

      <div className="border-b border-line">
        <div className="container-page flex min-h-[68px] items-center gap-4 py-2 md:min-h-[76px]">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" className="-ml-2 p-2 lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <Logo className="text-[19px] tracking-[0.3em] sm:text-[22px] sm:tracking-[0.36em]" />
            <span className="hidden border-l border-line pl-3 text-[10px] font-light tracking-[0.17em] text-muted lg:inline">INDEPENDENT LABELS</span>
          </div>

          <form role="search" className="hidden h-10 min-w-0 flex-1 items-center border border-line-strong bg-white sm:flex" onSubmit={submitSearch}>
            <Search size={18} strokeWidth={1.7} className="ml-3 shrink-0 text-muted" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search coats, knitwear, makers…"
              aria-label="Search the store"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted"
              maxLength={100}
            />
            <button type="submit" className="flex h-full items-center gap-2 border-l border-line px-3 text-muted transition-colors hover:text-ink" aria-label="Submit search">
              <span className="hidden text-xs md:inline">Search</span>
              <Search size={17} strokeWidth={1.7} />
            </button>
          </form>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-0.5 sm:ml-0 sm:gap-1">
            <button type="button" className="p-2 sm:hidden" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((value) => !value)}>
              <Search size={19} strokeWidth={1.5} />
            </button>
            <Link href={accountHref} className="hidden p-2 sm:block" aria-label={isMember ? 'Account' : 'Sign in'}>
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
          <div className="border-t border-line bg-paper sm:hidden">
            <form role="search" className="container-page flex items-center gap-3 py-3" onSubmit={submitSearch}>
              <Search size={18} strokeWidth={1.5} className="text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search coats, knitwear, makers…"
                aria-label="Search the store"
                className="w-full bg-transparent py-2 text-base outline-none"
                maxLength={100}
              />
              <button type="submit" className="label">Search</button>
            </form>
          </div>
        ) : null}

        <nav aria-label="Main" className="hidden border-t border-line lg:block">
          <div className="container-page">
            <ul className="flex min-h-[42px] items-center gap-8">
              {nav.map((item) => (
                <li key={item.href} className="shrink-0">
                  <Link href={item.href} aria-current={active(item.href) ? 'page' : undefined} className={`text-[13px] transition-colors hover:text-muted ${active(item.href) ? 'font-medium text-ink' : 'text-ink-2'}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

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
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';

const NAV = [
  { label: 'Overview', href: '/account', exact: true },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Addresses', href: '/account/addresses' },
  { label: 'Profile', href: '/account/profile' },
  { label: 'Wishlist', href: '/wishlist' },
];

/** Account frame: side navigation, and a guard that sends guests to sign in. */
export function AccountShell({ children }: { children: ReactNode }) {
  const { ready, enabled, isMember, claims, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (enabled && ready && !isMember) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [enabled, ready, isMember, pathname, router]);

  if (!enabled) {
    return (
      <div className="container-page py-16">
        <h1 className="display text-[40px]">My account</h1>
        <div className="mt-8 max-w-xl"><Notice>Accounts are not available in this demo. Everything else in the shop works as normal.</Notice></div>
      </div>
    );
  }
  if (!ready || !isMember) {
    return <div className="container-page py-24"><Spinner label="Loading your account" /></div>;
  }

  const links = [
    ...NAV,
    ...(claims.vendorId ? [{ label: 'Vendor dashboard', href: '/vendor' }] : []),
    ...(claims.admin ? [{ label: 'Admin', href: '/admin' }] : []),
  ];
  const isActive = (l: { href: string; exact?: boolean }) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <div className="container-page py-10 md:py-16">
      <p className="label text-muted">My account</p>
      <div className="mt-6 grid gap-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-16">
        <nav aria-label="Account" className="md:border-r md:border-line md:pr-8">
          <ul className="flex flex-wrap gap-x-5 gap-y-3 border-b border-line pb-5 md:block md:space-y-4 md:border-0 md:pb-0">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l) ? 'page' : undefined}
                  className={`text-sm ${isActive(l) ? 'text-ink underline underline-offset-[6px]' : 'text-muted hover:text-ink'}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
              >
                Sign out
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

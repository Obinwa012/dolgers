'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, Suspense, useContext, useState, type ReactNode } from 'react';
import type { VendorRole } from '@dolgers/shared';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthProvider';
import { Loading } from './ui';

export type DashboardArea = 'vendor' | 'admin';

export interface DashboardUser {
  uid: string;
  email: string;
  admin: boolean;
  /** Set in the vendor area. */
  vendorId: string;
  vendorRole: VendorRole | undefined;
}

const DashboardContext = createContext<DashboardUser | null>(null);

/** The signed-in dashboard user. Only valid inside a DashboardShell that granted access. */
export function useDashboard(): DashboardUser {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardShell');
  return ctx;
}

export interface NavItem {
  label: string;
  href: string;
}

function TopBar({ area }: { area: DashboardArea }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <div className="border-b border-line bg-paper">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Logo className="text-[18px]! md:text-[20px]!" />
          <span className="label border-l border-line pl-4 text-muted">{area === 'vendor' ? 'Vendor' : 'Admin'}</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="label hidden text-muted hover:text-ink sm:inline">Back to store</Link>
          <Link href="/" className="label text-muted hover:text-ink sm:hidden">Store</Link>
          {user && !user.isAnonymous ? (
            <button
              type="button"
              className="label text-muted hover:text-ink"
              onClick={async () => { await signOut(); router.push('/'); }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SideNav({ items, root }: { items: NavItem[]; root: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <>
      <nav aria-label="Dashboard" className="sticky top-0 z-10 border-b border-line bg-paper md:hidden">
        <ul className="flex gap-1 overflow-x-auto px-4 py-2">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active(item.href) ? 'page' : undefined}
                className={`label block px-3 py-2 ${active(item.href) ? 'bg-ink text-paper' : 'text-ink-2'}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Dashboard" className="hidden w-56 shrink-0 border-r border-line md:block">
        <ul className="sticky top-0 space-y-px py-8">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active(item.href) ? 'page' : undefined}
                className={`block border-l-2 py-2.5 pl-6 pr-4 text-sm transition-colors ${active(item.href) ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 md:py-28">
      <h1 className="display text-[32px] md:text-[40px]">{title}</h1>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function DemoMode({ area }: { area: DashboardArea }) {
  return (
    <Message title={area === 'vendor' ? 'The vendor dashboard needs Firebase' : 'The admin console needs Firebase'}>
      <p>
        This copy of DOLGERS is running in demo mode, with the bundled catalog and no backend. Dashboards read
        and write live data, so they only work when the site is connected to Firebase.
      </p>
      <p>To try them locally, run the Firebase emulators and seed them with test data:</p>
      <pre className="overflow-x-auto bg-stone px-4 py-3 text-[13px] leading-6">
        <code>{`npm run emulators\nnpm run seed`}</code>
      </pre>
      <p>
        Then copy <code className="bg-stone px-1">apps/web/.env.example</code> to{' '}
        <code className="bg-stone px-1">apps/web/.env.local</code> (it already points at the emulators), restart the site
        and sign in with a test account. The password for each is <code className="bg-stone px-1">password123</code>.
      </p>
      <ul className="list-inside list-disc">
        <li><strong className="font-medium">admin@dolgers.test</strong> for the admin console</li>
        <li><strong className="font-medium">vendor@dolgers.test</strong> for the Nordhavn vendor dashboard</li>
      </ul>
      <p><Link href="/" className="link-underline">Back to the store</Link></p>
    </Message>
  );
}

function NoAccess({ area }: { area: DashboardArea }) {
  const { refreshClaims, user } = useAuth();
  const [checking, setChecking] = useState(false);
  return (
    <Message title={area === 'vendor' ? 'No store on this account' : 'Admins only'}>
      {area === 'vendor' ? (
        <>
          <p>
            You are signed in as {user?.email ?? 'this account'}, which is not linked to a store on DOLGERS. If you
            make clothes for men or boys and would like to sell with us, tell us about your label.
          </p>
          <p>Approved recently? Refresh your access to load your store.</p>
        </>
      ) : (
        <p>
          You are signed in as {user?.email ?? 'this account'}, which does not have admin access. Ask an existing
          admin to add you from the Team page, then refresh your access.
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        {area === 'vendor' ? <Link href="/sell" className="btn btn-primary">Apply to sell</Link> : null}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try { await refreshClaims(); } finally { setChecking(false); }
          }}
        >
          {checking ? 'Checking…' : 'Refresh access'}
        </button>
      </div>
    </Message>
  );
}

/** Layout, navigation and access guard shared by /vendor and /admin. */
export function DashboardShell({ area, nav, children }: { area: DashboardArea; nav: NavItem[]; children: ReactNode }) {
  const { enabled, ready, user, claims } = useAuth();
  const pathname = usePathname();
  const root = `/${area}`;

  let body: ReactNode;
  let value: DashboardUser | null = null;
  if (!enabled) {
    body = <DemoMode area={area} />;
  } else if (!ready) {
    body = <div className="px-4 md:px-8"><Loading label="Checking your access" /></div>;
  } else if (!user || user.isAnonymous) {
    body = (
      <Message title="Please sign in">
        <p>{area === 'vendor' ? 'Sign in with the account that runs your store to open the vendor dashboard.' : 'Sign in with an admin account to open the console.'}</p>
        <p><Link href={`/sign-in?next=${encodeURIComponent(pathname || root)}`} className="btn btn-primary">Sign in</Link></p>
      </Message>
    );
  } else if (area === 'vendor' ? !claims.vendorId : !claims.admin) {
    body = <NoAccess area={area} />;
  } else {
    value = {
      uid: user.uid,
      email: user.email ?? '',
      admin: claims.admin === true,
      vendorId: claims.vendorId ?? '',
      vendorRole: claims.vendorRole,
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar area={area} />
      {value ? (
        <DashboardContext.Provider value={value}>
          <div className="flex flex-1 flex-col md:flex-row">
            <SideNav items={nav} root={root} />
            <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">
              <div className="mx-auto max-w-6xl">
                <Suspense fallback={<Loading />}>{children}</Suspense>
              </div>
            </main>
          </div>
        </DashboardContext.Provider>
      ) : (
        <main id="main" className="flex-1">{body}</main>
      )}
    </div>
  );
}

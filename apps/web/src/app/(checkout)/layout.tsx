import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { CheckoutHeaderNote } from '@/components/checkout/CheckoutHeaderNote';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Checkout keeps the page quiet: logo, a secure note, and a small footer. No shop navigation.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 md:h-20 md:px-10">
          <Logo />
          <CheckoutHeaderNote />
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <ul className="mx-auto flex w-full max-w-[1120px] flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-xs text-muted md:px-10">
          <li><Link href="/help/returns" className="hover:text-ink">Returns policy</Link></li>
          <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
          <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
          <li><Link href="/help/contact" className="hover:text-ink">Contact us</Link></li>
        </ul>
      </footer>
    </div>
  );
}

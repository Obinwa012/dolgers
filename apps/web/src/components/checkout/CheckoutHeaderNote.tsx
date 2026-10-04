'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Right side of the checkout header: "Secure checkout", or a help link once the order is placed. */
export function CheckoutHeaderNote() {
  const pathname = usePathname();
  if (pathname.startsWith('/checkout/confirmed')) {
    return (
      <p className="text-xs text-muted">
        Need help? <Link href="/help/contact" className="text-ink underline underline-offset-4">Contact us</Link>
      </p>
    );
  }
  return (
    <p className="label flex items-center gap-2 text-ink-2">
      <Lock size={13} strokeWidth={1.5} aria-hidden />
      <span className="sm:hidden">Secure</span>
      <span className="hidden sm:inline">Secure checkout</span>
    </p>
  );
}

import Link from 'next/link';
import { Logo } from './Logo';

const COLUMNS = [
  { title: 'Shop', links: [['Men', '/shop/men'], ['Boys', '/shop/boys'], ['Shoes', '/shoes'], ['Accessories', '/accessories'], ['New Arrivals', '/new-in']] },
  { title: 'Help', links: [['Delivery', '/help/delivery'], ['Returns', '/help/returns'], ['Size Guide', '/help/size-guide'], ['Contact Us', '/help/contact']] },
  { title: 'Company', links: [['About DOLGERS', '/about'], ['Sell With Us', '/sell'], ['Journal', '/journal'], ['Careers', '/careers']] },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-5 text-sm leading-relaxed text-muted">A marketplace of independent labels for men and boys.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="label text-ink">{col.title}</h2>
            <ul className="mt-5 space-y-3">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted transition-colors hover:text-ink">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DOLGERS. All rights reserved.</p>
          <ul className="flex gap-6">
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><Link href="/accessibility" className="hover:text-ink">Accessibility</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

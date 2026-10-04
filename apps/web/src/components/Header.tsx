import { getHome } from '@/lib/server/catalog';
import { HeaderBar } from './HeaderBar';

export const NAV = [
  { label: 'New in', href: '/new-in' },
  { label: 'Men', href: '/shop/men' },
  { label: 'Boys', href: '/shop/boys' },
  { label: 'Shoes', href: '/shoes' },
  { label: 'Accessories', href: '/accessories' },
  { label: 'Brands', href: '/brands' },
];

export async function Header() {
  const home = await getHome();
  return (
    <header className="sticky top-0 z-40 bg-paper">
      {home.announcement ? (
        <div className="bg-ink py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white">{home.announcement}</div>
      ) : null}
      <HeaderBar nav={NAV} />
    </header>
  );
}

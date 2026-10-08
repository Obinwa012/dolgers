import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-mist">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-4 sm:px-6">
        <Link href="/" className="display text-3xl tracking-tight text-denim-deep" aria-label="DOLGERS home">
          DOLGERS
        </Link>
        <nav aria-label="Departments" className="flex gap-6 text-[0.95rem] font-medium">
          <Link href="/men" className="hover:text-denim">Men</Link>
          <Link href="/women" className="hover:text-denim">Women</Link>
        </nav>
        <p className="ml-auto hidden text-sm text-ink-soft sm:block">Every order ships from a US warehouse</p>
      </div>
    </header>
  );
}

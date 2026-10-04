import Link from 'next/link';

export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" aria-label="DOLGERS home" className={`display text-[22px] tracking-[0.42em] md:text-[26px] ${light ? 'text-white' : 'text-ink'} ${className}`}>
      DOLGERS
    </Link>
  );
}

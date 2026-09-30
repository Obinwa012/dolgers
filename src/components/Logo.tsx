import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-white ${className}`} aria-label="Dolgers home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#E08A00" />
        <path d="M8 9h16v4h-6v12h-4V13H8z" fill="#1B1B1D" />
      </svg>
      <span className="font-display text-2xl font-semibold uppercase tracking-wider">Dolgers</span>
    </Link>
  );
}

import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-white ${className}`} aria-label="Torqline home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#f5b400" />
        <path d="M8 9h16v4h-6v12h-4V13H8z" fill="#062f36" />
      </svg>
      <span className="font-display text-2xl font-semibold uppercase tracking-wider">Torqline</span>
    </Link>
  );
}

import Link from "next/link";

/** Dolgers wordmark. `tone="light"` for dark backgrounds, default orange for light backgrounds. */
export default function Logo({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link href="/" className={`flex shrink-0 items-center gap-2 ${className}`} aria-label="Dolgers women's fashion, home">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-bright to-accent text-2xl font-black text-white">
        D
      </span>
      <span className="leading-none">
        <span className={`block text-[26px] font-black tracking-tight ${light ? "text-white" : "text-accent"}`}>Dolgers</span>
        <span className={`mt-0.5 block text-[10px] font-semibold tracking-[0.12em] ${light ? "text-white/70" : "text-muted"}`}>
          WOMEN&apos;S FASHION
        </span>
      </span>
    </Link>
  );
}

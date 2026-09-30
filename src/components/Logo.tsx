import Link from "next/link";

/** Dolgers wordmark. `tone="light"` for dark backgrounds, default dark text for light backgrounds. */
export default function Logo({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="Dolgers home">
      <span className="grid h-10 w-10 place-items-center rounded bg-accent font-display text-2xl font-black text-white">
        D
      </span>
      <span className="leading-none">
        <span className={`block font-display text-[28px] font-black tracking-wide ${light ? "text-white" : "text-ink"}`}>
          DOLGERS
        </span>
        <span className="block text-[9px] font-bold tracking-[3.5px] text-muted">
          PRO TOOLS &amp; HARDWARE
        </span>
      </span>
    </Link>
  );
}

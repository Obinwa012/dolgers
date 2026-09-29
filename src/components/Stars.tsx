import { Star } from "lucide-react";

/** Five-star rating row. The label carries the number for screen readers. */
export default function Stars({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? `, ${count} reviews` : ""}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} aria-hidden className={`${cls} ${i < Math.round(rating) ? "fill-accent text-accent" : "fill-slate-200 text-slate-200"}`} />
      ))}
      <span aria-hidden className="ml-1 text-xs text-muted">
        {rating.toFixed(1)}{count !== undefined ? ` (${count.toLocaleString("en-US")})` : ""}
      </span>
    </span>
  );
}

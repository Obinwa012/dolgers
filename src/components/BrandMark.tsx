import type { Brand } from "@/lib/types";

/** Text wordmark for a fictional demo brand. */
export default function BrandMark({ brand, small = false }: { brand: Brand; small?: boolean }) {
  return (
    <span
      className={`inline-block w-fit rounded font-display font-bold tracking-wide ${small ? "px-2 py-0.5 text-sm" : "px-3 py-1 text-lg"}`}
      style={{ background: brand.color, color: brand.textColor }}
    >
      {brand.name}
    </span>
  );
}

import type { IconKey } from "@/lib/types";

/** Flat garment silhouettes on a 100×100 grid: [body path, detail path (stroked, no fill)]. */
const GARMENTS: Record<IconKey, { body: string; detail: string }> = {
  dress: {
    body: "M39 10 L43 10 L46 22 Q50 27 54 22 L57 10 L61 10 L60 32 L57 46 L74 90 Q50 97 26 90 L43 46 L40 32 Z",
    detail: "M43 46 Q50 50 57 46 M50 52 L50 92",
  },
  top: {
    body: "M36 14 L50 20 L64 14 L86 28 L77 42 L68 37 L68 86 L32 86 L32 37 L23 42 L14 28 Z",
    detail: "M41 15 Q50 30 59 15 M50 30 L50 86",
  },
  knit: {
    body: "M37 13 L50 18 L63 13 L92 54 L81 61 L68 42 L68 88 L32 88 L32 42 L19 61 L8 54 Z",
    detail: "M32 80 L68 80 M42 14 Q50 24 58 14",
  },
  coat: {
    body: "M33 10 L45 10 L50 24 L55 10 L67 10 L90 58 L81 63 L71 44 L73 94 L27 94 L29 44 L19 63 L10 58 Z",
    detail: "M50 24 L50 94 M50 40 L50 40 M44 10 L50 24 L56 10",
  },
  pants: {
    body: "M32 8 L68 8 L73 92 L55 92 L50 42 L45 92 L27 92 Z",
    detail: "M32 16 L68 16 M50 16 L50 42",
  },
  denim: {
    body: "M31 8 L69 8 L75 92 L56 92 L50 40 L44 92 L25 92 Z",
    detail: "M31 16 L69 16 M36 16 Q41 28 47 24 M64 16 Q59 28 53 24 M50 16 L50 40",
  },
  skirt: {
    body: "M35 14 L65 14 L83 88 Q50 97 17 88 Z",
    detail: "M35 22 L65 22 M42 22 L36 90 M58 22 L64 90 M50 22 L50 92",
  },
  active: {
    body: "M37 8 L44 8 L50 17 L56 8 L63 8 L62 30 L38 30 Z M36 36 L64 36 L67 94 L53 94 L50 58 L47 94 L33 94 Z",
    detail: "M38 24 L62 24 M36 42 L64 42",
  },
  sleep: {
    body: "M30 8 L42 8 L50 15 L58 8 L70 8 L82 24 L73 33 L68 28 L68 50 L32 50 L32 28 L27 33 L18 24 Z M32 56 L68 56 L73 88 L54 88 L50 72 L46 88 L27 88 Z",
    detail: "M42 8 L50 28 L58 8 M32 50 L68 50",
  },
};

/** Colour a hex shade toward black (amt 0–1). */
function darken(hex: string, amt: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  if (!/^#[0-9a-f]{6}/i.test(hex)) return hex;
  const f = (c: number) => Math.round(c * (1 - amt));
  return `rgb(${f((n >> 16) & 255)} ${f((n >> 8) & 255)} ${f(n & 255)})`;
}

/** Plain garment glyph for small spots (category tiles, brand cards). Inherits `currentColor`. */
export function GarmentIcon({ icon, className = "" }: { icon: IconKey; className?: string }) {
  const g = GARMENTS[icon] ?? GARMENTS.dress;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      <path d={g.body} fillRule="evenodd" />
      <path d={g.detail} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Generated product/banner artwork. Used when a product has no `image` URL, so the store looks
 * complete before real photography is uploaded.
 */
export default function ClothingArt({
  icon,
  tint,
  image,
  alt = "",
  className = "",
  variant = "soft",
}: {
  icon: IconKey;
  tint: string;
  image?: string;
  alt?: string;
  className?: string;
  variant?: "soft" | "bold";
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt} className={`h-full w-full object-cover ${className}`} />;
  }
  const g = GARMENTS[icon] ?? GARMENTS.dress;
  const bold = variant === "bold";
  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{
        background: bold
          ? `linear-gradient(160deg, ${tint}, ${darken(tint, 0.45)})`
          : `linear-gradient(170deg, ${tint}1f 0%, #fbf7f4 62%, ${tint}14 100%)`,
      }}
    >
      <svg viewBox="0 0 100 100" className="relative h-[78%] w-[78%] drop-shadow-[0_6px_8px_rgba(0,0,0,0.12)]" aria-hidden>
        <path d={g.body} fill={bold ? "#ffffff" : tint} fillRule="evenodd" />
        <path
          d={g.detail}
          fill="none"
          stroke={bold ? tint : "#ffffff"}
          strokeOpacity={bold ? 0.6 : 0.65}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

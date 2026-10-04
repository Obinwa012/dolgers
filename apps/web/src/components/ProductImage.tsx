import Image from 'next/image';
import type { ProductImage as Img } from '@dolgers/shared';

// Placeholder tones from the mockup, used until a vendor uploads a photo.
const TONES: Record<string, { bg: string; dark: boolean }> = {
  charcoal: { bg: 'linear-gradient(180deg,#3b3936 0%,#22211f 100%)', dark: true },
  black: { bg: 'linear-gradient(180deg,#2b2b2b 0%,#121212 100%)', dark: true },
  stone: { bg: 'linear-gradient(180deg,#e9e7e3 0%,#d6d3cd 100%)', dark: false },
  ecru: { bg: 'linear-gradient(180deg,#f1efeb 0%,#e4e0d8 100%)', dark: false },
  sand: { bg: 'linear-gradient(180deg,#ece6dc 0%,#dacfbd 100%)', dark: false },
  grey: { bg: 'linear-gradient(180deg,#dededc 0%,#c4c3bf 100%)', dark: false },
};

export function isDarkTone(tone?: string) {
  return TONES[tone ?? '']?.dark ?? false;
}

/**
 * A product or editorial image. Real photos go through next/image (pre-sized WebP); demo items
 * render a toned placeholder with the shot description, as in the mockup.
 */
export function ProductImage({
  image,
  sizes,
  priority,
  className = '',
  showLabel = true,
}: {
  image: Img | null | undefined;
  sizes: string;
  priority?: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  if (image?.url) {
    return (
      <div className={`relative overflow-hidden bg-stone ${className}`}>
        <Image src={image.url} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const tone = TONES[image?.tone ?? ''] ?? TONES.stone;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: tone.bg }} role="img" aria-label={image?.alt ?? ''}>
      {showLabel && image?.alt ? (
        <span className={`absolute bottom-3 left-3 right-3 text-[9px] uppercase tracking-[0.16em] ${tone.dark ? 'text-white/45' : 'text-black/35'}`}>
          [Image] {image.alt}
        </span>
      ) : null}
    </div>
  );
}

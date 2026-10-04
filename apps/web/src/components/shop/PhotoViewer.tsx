'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { ProductImage as Img } from '@dolgers/shared';

/**
 * Full-screen photo viewer (lightbox) for product images.
 * Features: next/prev arrows, keyboard navigation (arrows, Esc),
 * swipe on mobile, counter (e.g. "2 / 5").
 */
export function PhotoViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: Img[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (i: number) => {
      const n = images.length;
      setIndex(((i % n) + n) % n); // wrap around
    },
    [images.length]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const img = images[index];
  if (!img) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Product photo viewer"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close viewer"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
        {index + 1} / {images.length}
      </div>

      {/* Prev arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-4"
          aria-label="Previous photo"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[90vh] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '90vw', height: '85vh' }}
      >
        {img.url ? (
          <Image
            src={img.url}
            alt={img.alt || `Product photo ${index + 1}`}
            fill
            className="object-contain"
            sizes="95vw"
            unoptimized={img.url.includes('alicdn.com')}
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/50">
            No image
          </div>
        )}
      </div>

      {/* Next arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-4"
          aria-label="Next photo"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

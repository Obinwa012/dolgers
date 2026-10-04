'use client';

import { useRef, useState } from 'react';
import type { ProductImage as Img } from '@dolgers/shared';
import { ProductImage, isDarkTone } from '@/components/ProductImage';
import { PhotoViewer } from './PhotoViewer';

/** Desktop: a 2x2 grid of shots. Mobile: a swipeable strip with a counter and dots. */
export function ProductGallery({ images, title }: { images: Img[]; title: string }) {
  const shots = images.length ? images : [{ url: '', alt: title, tone: 'stone' }];
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: 'smooth' });

  return (
    <>
      <div className="relative -mx-4 md:hidden">
        <div
          ref={strip}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carousel"
          aria-label={`${title} photos`}
        >
          {shots.map((img, i) => (
            <div key={i} className="w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={`${i + 1} of ${shots.length}`}>
              <button
                onClick={() => setViewerIndex(i)}
                className="block w-full cursor-zoom-in"
                aria-label={`View photo ${i + 1} fullscreen`}
              >
                <ProductImage image={img} sizes="100vw" priority={i < 2} className="aspect-[4/5] w-full" />
              </button>
            </div>
          ))}
        </div>
        {shots.length > 1 ? (
          <>
            <span className={`absolute right-3 top-3 px-2 py-1 text-[11px] ${isDarkTone(shots[index]?.tone) ? 'bg-white/90' : 'bg-paper'}`} aria-hidden>
              {index + 1} / {shots.length}
            </span>
            <div className="mt-3 flex justify-center gap-1.5">
              {shots.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  className="flex h-6 items-center"
                >
                  <span className={`block h-px w-5 ${i === index ? 'bg-ink' : 'bg-line-strong'}`} />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="hidden grid-cols-2 gap-2 md:grid">
        {shots.map((img, i) => (
          <button
            key={i}
            onClick={() => setViewerIndex(i)}
            className="cursor-zoom-in"
            aria-label={`View photo ${i + 1} fullscreen`}
          >
            <ProductImage image={img} sizes="(min-width: 1024px) 30vw, 45vw" priority={i < 2} className="aspect-[3/4] w-full" />
          </button>
        ))}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          images={shots}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}

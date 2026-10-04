'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HomeHero } from '@dolgers/shared';
import { ProductImage, isDarkTone } from '@/components/ProductImage';

const ROTATION_INTERVAL = 7000;

export function HeroCarousel({ slides }: { slides: HomeHero[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(
      () => setActiveIndex((index) => (index + 1) % slides.length),
      ROTATION_INTERVAL,
    );
    return () => window.clearInterval(timer);
  }, [activeIndex, focused, hovered, paused, reducedMotion, slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[activeIndex];
  const dark = !!slide.image?.url || isDarkTone(slide.image?.tone);
  const textTone = dark ? 'text-white' : 'text-ink';

  const move = (offset: number) => {
    setActiveIndex((index) => (index + offset + slides.length) % slides.length);
  };

  return (
    <section
      className={`relative isolate min-h-[620px] w-full overflow-hidden md:min-h-[calc(100svh-108px)] ${textTone}`}
      aria-label="Featured campaigns"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="absolute inset-0">
        <ProductImage
          image={slide.image}
          sizes="100vw"
          priority={activeIndex === 0}
          showLabel={false}
          className="h-full w-full"
        />
      </div>
      {slide.image?.url ? <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-black/5" aria-hidden="true" /> : null}

      <div key={activeIndex} className="hero-slide-enter relative flex min-h-[620px] flex-col justify-end px-5 pb-24 pt-28 sm:px-10 md:min-h-[calc(100svh-108px)] md:px-16 md:pb-24">
        <div className="max-w-4xl">
          {slide.eyebrow ? <p className={`label ${dark ? 'text-white/80' : 'text-muted'}`}>{slide.eyebrow}</p> : null}
          <h1 className="display mt-5 max-w-4xl text-[56px] sm:text-[72px] md:text-[104px]">{slide.title}</h1>
          {slide.body ? <p className={`mt-6 max-w-md text-[15px] leading-relaxed ${dark ? 'text-white/80' : 'text-muted'}`}>{slide.body}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {slide.primary.label ? <Link href={slide.primary.href} className={`btn ${dark ? 'btn-light' : 'btn-primary'}`}>{slide.primary.label}</Link> : null}
            {slide.secondary.label ? (
              <Link href={slide.secondary.href} className={`btn ${dark ? 'btn-outline-light' : 'btn-secondary'}`}>{slide.secondary.label}</Link>
            ) : null}
          </div>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-5 sm:px-10 md:px-16 md:pb-8">
          <div className="flex items-center gap-2" aria-label="Choose a campaign">
            {slides.map((item, index) => (
              <button
                type="button"
                key={`${item.title}-${index}`}
                className={`h-1 min-w-8 transition-all ${index === activeIndex ? 'w-12 bg-current' : 'w-8 bg-current/45 hover:bg-current/75'}`}
                aria-label={`Show campaign ${index + 1}: ${item.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full border border-current/50 p-2 transition-colors hover:bg-current/10" aria-label="Previous campaign" onClick={() => move(-1)}>
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button type="button" className="rounded-full border border-current/50 p-2 transition-colors hover:bg-current/10" aria-label="Next campaign" onClick={() => move(1)}>
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="rounded-full border border-current/50 p-2 transition-colors hover:bg-current/10"
              aria-label={paused ? 'Resume automatic slideshow' : 'Pause automatic slideshow'}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={16} strokeWidth={1.5} /> : <Pause size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

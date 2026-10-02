"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { GarmentIcon } from "@/components/ClothingArt";
import type { IconKey } from "@/lib/types";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  /** Big price callout, e.g. "$49". */
  callout?: string;
  calloutNote?: string;
  cta: string;
  href: string;
  icon: IconKey;
  bg: string; // CSS background
}

const INTERVAL = 5000;
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Rotating promo banner. Auto-advances every 5s, pauses on hover/focus and with the pause button
 * (WCAG 2.2.2), and doesn't auto-advance at all for prefers-reduced-motion.
 */
export default function HeroCarousel({ slides, className = "" }: { slides: HeroSlide[]; className?: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false); // user pressed pause
  const [hovering, setHovering] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => matchMedia(REDUCED).matches, () => false);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (paused || hovering || reduced || n < 2) return;
    const t = setTimeout(() => go(i + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [i, paused, hovering, reduced, n, go]);

  const playing = !paused && !reduced;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className={`relative overflow-hidden rounded-xl text-white ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHovering(false)}
    >
      {/* All slides share one grid cell, so the banner is as tall as its tallest slide. */}
      <div className="grid h-full">
        {slides.map((s, k) => {
          const active = k === i;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${n}: ${s.title}`}
              inert={!active}
              className={`relative overflow-hidden transition-opacity duration-700 [grid-area:1/1] motion-reduce:transition-none ${active ? "z-[1] opacity-100" : "pointer-events-none opacity-0"}`}
              style={{ background: s.bg }}
            >
              <div aria-hidden className="absolute -right-16 top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-white/10 md:block" />
              <div aria-hidden className="absolute right-24 top-1/2 hidden h-[260px] w-[260px] -translate-y-1/2 rounded-full bg-white/10 md:block" />
              <GarmentIcon icon={s.icon} className="absolute right-12 top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 rotate-[8deg] text-white/90 drop-shadow-[0_14px_20px_rgba(0,0,0,0.25)] md:block" />
              <div className="relative flex h-full min-h-[300px] flex-col justify-center px-7 py-9 md:px-12 lg:min-h-[380px]">
                <div className="max-w-[420px]">
                  <p className="inline-block rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold tracking-wide">{s.eyebrow}</p>
                  <h2 className="mt-3.5 text-[32px] font-black leading-[1.1] md:text-[40px]">{s.title}</h2>
                  <p className="mt-3 max-w-[360px] text-[15px] font-medium text-white/95">{s.text}</p>
                  {s.callout && (
                    <p className="mt-4 flex items-baseline gap-2.5">
                      <span className="text-4xl font-black">{s.callout}</span>
                      {s.calloutNote && <span className="text-sm font-medium text-white/90">{s.calloutNote}</span>}
                    </p>
                  )}
                  <Link href={s.href} className="mt-6 inline-block rounded-full bg-white px-9 py-3 text-[15px] font-bold text-accent shadow-lg transition hover:bg-brand-50">
                    {s.cta} &rarr;
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button onClick={() => go(i - 1)} aria-label="Previous promotion" className="absolute left-3 top-1/2 z-[2] hidden sm:grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/25 hover:bg-black/45">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(i + 1)} aria-label="Next promotion" className="absolute right-3 top-1/2 z-[2] hidden sm:grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/25 hover:bg-black/45">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3.5 z-[2] flex items-center justify-center gap-2">
            {slides.map((s, k) => (
              <button
                key={s.id}
                onClick={() => go(k)}
                aria-label={`Show promotion ${k + 1}: ${s.title}`}
                aria-current={k === i}
                className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
            {!reduced && (
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={playing ? "Pause rotation" : "Resume rotation"}
                className="ml-2 grid h-6 w-6 place-items-center rounded-full bg-black/25 hover:bg-black/45"
              >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

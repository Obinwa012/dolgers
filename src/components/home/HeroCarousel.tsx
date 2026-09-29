"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ICONS } from "@/components/ToolArt";
import type { IconKey } from "@/lib/types";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  /** Big price/savings callout, e.g. "$499" or "Save $200". */
  callout?: string;
  calloutNote?: string;
  cta: string;
  href: string;
  icon: IconKey;
  bg: string; // CSS background
  accent: string; // hex
}

const INTERVAL = 6000;
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Rotating hero. Auto-advances every 6s, pauses on hover/focus and with the pause button
 * (WCAG 2.2.2), and doesn't auto-advance at all for prefers-reduced-motion.
 */
export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
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
      className="relative overflow-hidden bg-ink text-white"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHovering(false)}
    >
      {/* All slides share one grid cell, so the hero is as tall as its tallest slide (nothing clips). */}
      <div className="grid">
        {slides.map((s, k) => {
          const Icon = ICONS[s.icon];
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
              <Icon
                aria-hidden
                strokeWidth={0.9}
                className="absolute -right-16 top-1/2 h-[320px] w-[320px] -translate-y-1/2 opacity-20 md:right-[4%] md:h-[460px] md:w-[460px] md:opacity-90 xl:h-[520px] xl:w-[520px]"
                style={{ color: s.accent }}
              />
              <div className="container-x relative flex min-h-[460px] flex-col justify-center pb-24 pt-10 md:min-h-[540px]">
                <div className="max-w-2xl">
                  <p
                    className="inline-block -skew-x-12 px-3 py-1 font-display text-sm uppercase tracking-[0.2em] text-ink md:text-base"
                    style={{ background: s.accent }}
                  >
                    <span className="inline-block skew-x-12">{s.eyebrow}</span>
                  </p>
                  <h2 className="mt-4 font-display text-4xl uppercase leading-[0.95] sm:text-5xl md:max-w-xl md:text-6xl xl:max-w-2xl xl:text-7xl">{s.title}</h2>
                  <p className="mt-4 max-w-lg text-white/85 md:text-lg">{s.text}</p>
                  {s.callout && (
                    <p className="mt-5 flex items-baseline gap-3">
                      <span className="font-display text-4xl md:text-6xl" style={{ color: s.accent }}>{s.callout}</span>
                      {s.calloutNote && <span className="text-sm text-white/80 md:text-base">{s.calloutNote}</span>}
                    </p>
                  )}
                  <Link href={s.href} className="btn mt-7 px-8 text-lg text-ink hover:bg-white" style={{ background: s.accent }}>
                    {s.cta}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="container-x absolute inset-x-0 bottom-6 z-[2] flex items-center gap-3">
          <button onClick={() => go(i - 1)} aria-label="Previous promotion" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            {slides.map((s, k) => (
              <button
                key={s.id}
                onClick={() => go(k)}
                aria-label={`Show promotion ${k + 1}: ${s.title}`}
                aria-current={k === i}
                className={`h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <button onClick={() => go(i + 1)} aria-label="Next promotion" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/30">
            <ChevronRight className="h-5 w-5" />
          </button>
          {!reduced && (
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={playing ? "Pause rotation" : "Resume rotation"}
              className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/30"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

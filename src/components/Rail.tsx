"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Horizontally scrolling rail with arrows and a progress bar (scroll-snap, no library). */
export default function Rail({
  children,
  itemClass = "w-[78%] sm:w-[45%] md:w-[31%] lg:w-[23.5%] xl:w-[19%]",
  label,
}: {
  children: ReactNode;
  itemClass?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  // Visible fraction of the track. 1 means everything fits, so arrows and the bar are hidden.
  const [ratio, setRatio] = useState(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setRatio(el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1);
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  // Measure on mount and whenever the rail or its content resizes (fonts, viewport, tab switch).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure]);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const scrollable = ratio < 0.999;

  return (
    <div className="group/rail relative">
      <div
        ref={ref}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-5"
        role="region"
        aria-label={label}
        tabIndex={scrollable ? 0 : undefined}
      >
        {Children.map(children, (c) => (
          <div className={`shrink-0 snap-start ${itemClass}`}>{c}</div>
        ))}
      </div>
      {scrollable && (
        <>
          {[-1, 1].map((d) => (
            <button
              key={d}
              onClick={() => go(d as 1 | -1)}
              aria-label={d < 0 ? "Previous" : "Next"}
              className={`absolute top-1/3 hidden h-11 w-11 place-items-center rounded-full bg-white shadow-lg transition hover:bg-ink hover:text-white md:grid md:opacity-0 md:group-hover/rail:opacity-100 md:focus-visible:opacity-100 ${d < 0 ? "-left-4" : "-right-4"}`}
            >
              {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          ))}
          <div className="relative mt-6 h-[3px] bg-slate-300" aria-hidden>
            <div
              className="absolute inset-y-0 bg-ink transition-[left]"
              style={{ width: `${ratio * 100}%`, left: `${progress * (1 - ratio) * 100}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

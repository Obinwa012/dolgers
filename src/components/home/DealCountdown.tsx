"use client";

import { useEffect, useState } from "react";

/** Live countdown to end of the current week (Sunday 23:59:59 local). */
export default function DealCountdown() {
  const [left, setLeft] = useState({ d: "00", h: "00", m: "00", s: "00" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() + ((7 - now.getDay()) % 7));
      end.setHours(23, 59, 59, 999);
      const ms = Math.max(0, end.getTime() - now.getTime());
      const p = (n: number) => String(n).padStart(2, "0");
      setLeft({
        d: p(Math.floor(ms / 86400000)),
        h: p(Math.floor((ms % 86400000) / 3600000)),
        m: p(Math.floor((ms % 3600000) / 60000)),
        s: p(Math.floor((ms % 60000) / 1000)),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const cells: [string, string][] = [
    [left.d, "Days"],
    [left.h, "Hrs"],
    [left.m, "Min"],
    [left.s, "Sec"],
  ];
  return (
    <div className="flex items-center gap-2.5" role="timer" aria-label="Time left in this week's deals">
      {cells.map(([v, label], i) => (
        <span key={label} className="flex items-center gap-2.5">
          {i > 0 && <span className="font-display text-[22px] font-black text-muted/50">:</span>}
          <span className="grid min-w-[62px] place-items-center rounded bg-accent px-1.5 py-2 text-center text-white">
            <b className="font-display text-[22px] font-black leading-none">{v}</b>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

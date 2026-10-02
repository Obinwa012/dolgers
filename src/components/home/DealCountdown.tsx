"use client";

import { useEffect, useState } from "react";

/** Live countdown to the end of today (local midnight), shown as HH : MM : SS. */
export default function DealCountdown() {
  const [left, setLeft] = useState({ h: "--", m: "--", s: "--" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const ms = Math.max(0, end.getTime() - now.getTime());
      const p = (n: number) => String(n).padStart(2, "0");
      setLeft({ h: p(Math.floor(ms / 3600000)), m: p(Math.floor((ms % 3600000) / 60000)), s: p(Math.floor((ms % 60000) / 1000)) });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-sm text-[#666]" role="timer" aria-label="Time left in today's flash deals">
      <span>Ends in</span>
      {[left.h, left.m, left.s].map((v, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <b className="text-ink">:</b>}
          <span className="grid h-6 min-w-7 place-items-center rounded bg-ink px-1 text-[13px] font-bold tabular-nums text-white">{v}</span>
        </span>
      ))}
    </div>
  );
}

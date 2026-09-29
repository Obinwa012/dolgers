import { Zap } from "lucide-react";

const messages = [
  "Autumn Tool Event: up to 40% off selected kits",
  "Free shipping on orders over $99",
  "New customers: 5% off with code FIRSTBUILD",
];

export default function AnnouncementBar() {
  const row = [...messages, ...messages, ...messages];
  return (
    <div className="overflow-hidden bg-ink text-white" aria-label="Store announcements">
      <div className="flex w-max animate-marquee py-2 hover:[animation-play-state:paused]">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
            {row.map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-2 px-10 text-xs font-medium uppercase tracking-wide"
              >
                <Zap className="h-3.5 w-3.5 fill-accent text-accent" />
                {m}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

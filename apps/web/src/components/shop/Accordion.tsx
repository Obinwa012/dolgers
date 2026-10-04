import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/** Disclosure built on <details>, so it works without JavaScript and is keyboard accessible. */
export function Accordion({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-line" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
        <span className="label">{title}</span>
        <Plus size={14} strokeWidth={1.5} aria-hidden className="group-open:hidden" />
        <Minus size={14} strokeWidth={1.5} aria-hidden className="hidden group-open:block" />
      </summary>
      <div className="space-y-3 pb-6 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

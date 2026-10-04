'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FilterPanel, type FilterOptions } from './FilterPanel';
import type { ListingState } from './query';

/** Mobile filter sheet: the same panel as the desktop sidebar, in a dialog. */
export function FilterDrawer({
  pathname,
  state,
  options,
  found,
  activeCount,
}: {
  pathname: string;
  state: ListingState;
  options: FilterOptions;
  found: number;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="label flex h-12 w-full items-center justify-center gap-2"
      >
        <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />
        Filter{activeCount ? ` (${activeCount})` : ''}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filter products">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-[90%] max-w-sm flex-col bg-paper">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <h2 className="label">Filter</h2>
              <button ref={closeRef} type="button" aria-label="Close filters" className="p-2" onClick={() => setOpen(false)}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4">
              <FilterPanel pathname={pathname} state={state} options={options} idPrefix="drawer" inDialog />
            </div>
            <div className="border-t border-line p-4">
              <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
                Show {found} {found === 1 ? 'item' : 'items'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

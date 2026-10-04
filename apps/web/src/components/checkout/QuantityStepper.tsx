'use client';

import { Minus, Plus } from 'lucide-react';
import { MAX_LINE_QUANTITY } from '@dolgers/shared';

export function QuantityStepper({
  value,
  onChange,
  label,
  max = MAX_LINE_QUANTITY,
}: {
  value: number;
  onChange(next: number): void;
  /** What the stepper changes, for screen readers, e.g. "Merino Rib Crewneck". */
  label: string;
  max?: number;
}) {
  const limit = Math.max(1, Math.min(MAX_LINE_QUANTITY, max));
  return (
    <div className="inline-flex h-11 items-center border border-line-strong" role="group" aria-label={`Quantity of ${label}`}>
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={`Decrease quantity of ${label}`}
      >
        <Minus size={14} strokeWidth={1.5} />
      </button>
      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={value >= limit}
        aria-label={`Increase quantity of ${label}`}
      >
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

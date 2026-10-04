'use client';

import type { InputHTMLAttributes } from 'react';

/**
 * Dollar amount input. The value stays as typed text; convert it with parseDollars() from
 * ./format when saving, so prices reach the server as integer cents.
 */
export function MoneyInput({
  value,
  onChange,
  className = '',
  ...rest
}: { value: string; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="field pl-7 tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
      />
    </div>
  );
}

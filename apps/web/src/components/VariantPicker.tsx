'use client';

import { useMemo, useState } from 'react';
import type { Product } from '@/lib/catalog';

function money(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}

export function VariantPicker({ variants, colors, sizes }: Pick<Product, 'variants' | 'colors' | 'sizes'>) {
  const [color, setColor] = useState(colors[0] ?? '');
  const [size, setSize] = useState<string | null>(null);
  const available = useMemo(
    () => new Set(variants.filter((v) => v.color === color && v.inStock).map((v) => v.size)),
    [variants, color],
  );
  const chosen = variants.find((v) => v.color === color && v.size === size);

  return (
    <div className="space-y-6">
      {colors.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-semibold">Color: <span className="font-normal text-ink-soft">{color}</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === color}
                onClick={() => {
                  setColor(c);
                  setSize(null);
                }}
                className={`rounded-md border px-3 py-2 text-sm ${c === color ? 'border-denim bg-denim text-paper' : 'border-stitch hover:border-denim'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm font-semibold">Color: <span className="font-normal text-ink-soft">{color}</span></p>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">Size</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {sizes.map((s) => {
            const ok = available.has(s);
            return (
              <button
                key={s}
                type="button"
                disabled={!ok}
                aria-pressed={s === size}
                onClick={() => setSize(s)}
                className={`min-w-14 rounded-md border px-3 py-2 text-sm font-medium ${
                  s === size ? 'border-denim bg-denim text-paper' : 'border-stitch hover:border-denim'
                } disabled:cursor-not-allowed disabled:border-mist disabled:text-stitch disabled:line-through`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <p className="text-2xl font-semibold" aria-live="polite">
          {chosen ? money(chosen.priceCents) : 'Choose a size'}
        </p>
        <button
          type="button"
          disabled
          className="mt-3 w-full rounded-md bg-denim px-5 py-3.5 font-semibold text-paper disabled:opacity-60 sm:w-auto"
        >
          Checkout opens soon
        </button>
        <p className="mt-2 text-sm text-ink-soft">We’re vetting our first products. Ordering opens when checkout launches.</p>
      </div>
    </div>
  );
}

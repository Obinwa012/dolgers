'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition, type FormEvent } from 'react';
import { listingHref, toggle, type ListingState } from './query';

export interface FilterOptions {
  sizes: { value: string; count: number }[];
  colours: { value: string; count: number; hex: string }[];
  brands: { value: string; count: number }[];
}

/** Size, colour, brand and price filters. Every change is a URL change, so results are shareable. */
export function FilterPanel({
  pathname,
  state: urlState,
  options,
  idPrefix,
  onNavigate,
  inDialog = false,
}: {
  pathname: string;
  state: ListingState;
  options: FilterOptions;
  idPrefix: string;
  onNavigate?: () => void;
  /** In the mobile drawer the dialog already has a "Filter" title. */
  inDialog?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Shows the shopper's choice immediately while the new results load.
  const [state, setOptimistic] = useOptimistic(urlState);
  const [min, setMin] = useState(urlState.min);
  const [max, setMax] = useState(urlState.max);

  const go = (patch: Partial<ListingState>) => {
    startTransition(() => {
      setOptimistic({ ...state, ...patch });
      router.push(listingHref(pathname, state, patch), { scroll: false });
    });
  };

  const applyPrice = (e?: FormEvent) => {
    e?.preventDefault();
    const clean = (v: string) => (/^\d{1,6}(\.\d{0,2})?$/.test(v.trim()) ? v.trim() : '');
    if (clean(min) === state.min && clean(max) === state.max) return;
    go({ min: clean(min), max: clean(max) });
    onNavigate?.();
  };

  const hasFilters = state.sizes.length + state.colours.length + state.brands.length > 0 || !!state.min || !!state.max;

  return (
    <div aria-busy={pending} className={pending ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
      <div className={`flex items-center justify-between border-b border-line pb-5 ${inDialog && !hasFilters ? 'hidden' : ''}`}>
        {inDialog ? <span /> : <h2 className="label">Filter</h2>}
        {hasFilters ? (
          <button
            type="button"
            className="text-xs text-muted underline underline-offset-4 hover:text-ink"
            onClick={() => {
              setMin('');
              setMax('');
              go({ sizes: [], colours: [], brands: [], min: '', max: '' });
            }}
          >
            Clear all
          </button>
        ) : null}
      </div>

      {options.sizes.length ? (
        <fieldset className="border-b border-line py-6">
          <legend className="label mb-4 float-left w-full">Size</legend>
          <div className="clear-both grid grid-cols-3 gap-1.5">
            {options.sizes.map((s) => {
              const on = state.sizes.includes(s.value);
              const empty = s.count === 0 && !on;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  disabled={empty}
                  title={empty ? 'None in stock with these filters' : `${s.count} in stock`}
                  onClick={() => go({ sizes: toggle(state.sizes, s.value) })}
                  className={`h-11 border text-xs transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink'} ${empty ? 'cursor-not-allowed text-faint line-through hover:border-line-strong' : ''}`}
                >
                  {s.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {options.colours.length ? (
        <fieldset className="border-b border-line py-6">
          <legend className="label mb-4 float-left w-full">Colour</legend>
          <ul className="clear-both space-y-1">
            {options.colours.map((c) => {
              const on = state.colours.includes(c.value);
              return (
                <li key={c.value}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => go({ colours: toggle(state.colours, c.value) })}
                    className="flex w-full items-center gap-3 py-1.5 text-left text-sm"
                  >
                    <span
                      aria-hidden
                      className={`h-[18px] w-[18px] shrink-0 rounded-full border ${on ? 'outline outline-1 outline-offset-2 outline-ink' : ''}`}
                      style={{ background: c.hex, borderColor: 'rgb(0 0 0 / 0.12)' }}
                    />
                    <span className={on ? 'font-medium' : ''}>{c.value}</span>
                    <span className="ml-auto text-xs text-faint">{c.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {options.brands.length ? (
        <fieldset className="border-b border-line py-6">
          <legend className="label mb-4 float-left w-full">Brand</legend>
          <ul className="clear-both space-y-1">
            {options.brands.map((b) => {
              const id = `${idPrefix}-brand-${b.value.replace(/[^a-z0-9]+/gi, '-')}`;
              return (
                <li key={b.value} className="flex items-center gap-3 py-1.5">
                  <input
                    id={id}
                    type="checkbox"
                    checked={state.brands.includes(b.value)}
                    onChange={() => go({ brands: toggle(state.brands, b.value) })}
                    className="h-4 w-4 accent-ink"
                  />
                  <label htmlFor={id} className="text-sm">{b.value}</label>
                  <span className="ml-auto text-xs text-faint">{b.count}</span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      <form className="py-6" onSubmit={applyPrice}>
        <fieldset>
          <legend className="label mb-4">Price</legend>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${idPrefix}-min`} className="field-label">Min ($)</label>
              <input
                id={`${idPrefix}-min`}
                inputMode="decimal"
                placeholder="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                onBlur={() => applyPrice()}
                className="field"
                maxLength={9}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-max`} className="field-label">Max ($)</label>
              <input
                id={`${idPrefix}-max`}
                inputMode="decimal"
                placeholder="Any"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                onBlur={() => applyPrice()}
                className="field"
                maxLength={9}
              />
            </div>
          </div>
          <button type="submit" className="sr-only">Apply price</button>
        </fieldset>
      </form>
    </div>
  );
}

'use client';

import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { Product } from '@dolgers/shared';

/** Pick and order up to `max` products by id from a list of candidates. */
export function ProductPicker({
  label,
  products,
  value,
  onChange,
  max,
}: {
  label: string;
  products: Product[];
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const matches = products
    .filter((p) => !value.includes(p.id))
    .filter((p) => !q || `${p.title} ${p.vendorName}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <fieldset className="min-w-0">
      <legend className="field-label">{label} ({value.length} of {max})</legend>
      {value.length ? (
        <ol className="mb-3 divide-y divide-line border border-line">
          {value.map((pid, i) => {
            const p = byId.get(pid);
            return (
              <li key={pid} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-5 text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {p ? <>{p.title} <span className="text-muted">· {p.vendorName}</span></> : <span className="text-danger">{pid} (not live)</span>}
                </span>
                <button type="button" className="p-1 disabled:opacity-30" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="p-1 disabled:opacity-30" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="p-1" aria-label={`Remove ${p?.title ?? pid}`} onClick={() => onChange(value.filter((v) => v !== pid))}><X size={14} /></button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {value.length < max ? (
        <div>
          <label htmlFor={`${id}-q`} className="sr-only">Search live products</label>
          <input id={`${id}-q`} type="search" className="field min-h-10" placeholder="Search live products to add" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-1 max-h-56 overflow-y-auto border border-line">
            {matches.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No matching live products.</li> : matches.map((p) => (
              <li key={p.id}>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-cream" onClick={() => onChange([...value, p.id])}>
                  {p.title} <span className="text-muted">· {p.vendorName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </fieldset>
  );
}

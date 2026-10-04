import type { ReactNode } from 'react';
import { formatMoney, type Cents, type ProductImage as Img } from '@dolgers/shared';
import { ProductImage } from '@/components/ProductImage';

export interface SummaryLine {
  sku: string;
  vendorName: string;
  title: string;
  colour: string;
  size: string;
  quantity: number;
  /** Null while the server price is not known yet. */
  lineTotal: Cents | null;
  image: Img | null;
}

export function lineMeta(l: { colour: string; size: string; quantity?: number }): string {
  return [l.colour, l.size, l.quantity !== undefined ? `Qty ${l.quantity}` : null].filter(Boolean).join(' · ');
}

/** Label / value rows used under every order summary. */
export function TotalsRows({ rows, total }: { rows: { label: string; value: ReactNode; muted?: boolean }[]; total: { label: string; value: ReactNode } }) {
  return (
    <div>
      <dl className="space-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className={`flex justify-between gap-4 ${r.muted ? 'text-muted' : ''}`}>
            <dt>{r.label}</dt>
            <dd className="text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-line-strong pt-5">
        <span className="text-[17px] font-medium">{total.label}</span>
        <span className="text-[19px] font-medium">{total.value}</span>
      </div>
    </div>
  );
}

export function SummaryLines({ lines }: { lines: SummaryLine[] }) {
  return (
    <ul className="space-y-5">
      {lines.map((l) => (
        <li key={l.sku} className="flex gap-4">
          <ProductImage image={l.image} sizes="64px" showLabel={false} className="h-[84px] w-16 shrink-0" />
          <div className="min-w-0 flex-1 self-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{l.vendorName}</p>
            <p className="mt-1 text-sm leading-snug">{l.title}</p>
            <p className="mt-1 text-xs text-muted">{lineMeta(l)}</p>
          </div>
          <p className="self-center text-sm font-medium">{l.lineTotal === null ? '—' : formatMoney(l.lineTotal)}</p>
        </li>
      ))}
    </ul>
  );
}

export function money(cents: Cents | null | undefined): string {
  return cents === null || cents === undefined ? '—' : formatMoney(cents);
}

import Link from 'next/link';
import type { ReactNode } from 'react';
import { humanize } from './format';

/** Title row at the top of every dashboard page. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; href: string };
}) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      {back ? (
        <Link href={back.href} className="label mb-4 inline-block text-muted hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="label mb-2 text-muted">{eyebrow}</p> : null}
          <h1 className="display break-words text-[30px] md:text-[38px]">{title}</h1>
          {description ? <div className="mt-2 max-w-2xl text-sm text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

type Tone = 'neutral' | 'warn' | 'good' | 'bad' | 'info';

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  archived: 'neutral',
  awaiting_payment: 'neutral',
  pending_payment: 'neutral',
  in_review: 'warn',
  pending: 'warn',
  requested: 'warn',
  preparing: 'warn',
  partially_shipped: 'info',
  partially_refunded: 'info',
  live: 'good',
  active: 'good',
  approved: 'good',
  paid: 'good',
  shipped: 'good',
  refunded: 'info',
  rejected: 'bad',
  suspended: 'bad',
  cancelled: 'bad',
  blocked: 'bad',
  reversed: 'bad',
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-stone text-ink-2',
  warn: 'bg-[#f6efe0] text-[#6e5320]',
  good: 'bg-[#e9f1ea] text-success',
  bad: 'bg-[#f7ebe8] text-danger',
  info: 'bg-[#e8edf3] text-[#2c3a5c]',
};

const STATUS_LABEL: Record<string, string> = { in_review: 'In review', awaiting_payment: 'Awaiting payment', pending_payment: 'Awaiting payment' };

export function StatusBadge({ status, label, tone }: { status: string; label?: string; tone?: Tone }) {
  const t = tone ?? STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] ${TONE_CLASS[t]}`}>
      {label ?? STATUS_LABEL[status] ?? humanize(status)}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="display text-[22px]">{title}</p>
      {body ? <div className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</div> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border border-faint border-t-ink" aria-hidden />
      {label}…
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="bg-[#f7ebe8] px-4 py-3 text-sm text-danger">{children}</p>;
}

export function SuccessText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="status" className="bg-[#e9f1ea] px-4 py-3 text-sm text-success">{children}</p>;
}

/** A bordered block with a small uppercase title, used to group content. */
export function Panel({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-line ${className}`}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          {title ? <h2 className="label text-ink">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, href, hint }: { label: string; value: ReactNode; href?: string; hint?: string }) {
  const body = (
    <>
      <p className="label text-muted">{label}</p>
      <p className="display mt-3 text-[34px] leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block border border-line p-5 transition-colors hover:border-ink">{body}</Link>
  ) : (
    <div className="border border-line p-5">{body}</div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

/** Dense table with thin rules. Scrolls sideways inside itself on small screens. */
export function DataTable<T>({ columns, rows, rowKey, caption }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ink">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`label whitespace-nowrap px-3 py-3 font-medium text-muted first:pl-0 last:pr-0 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line align-top">
              {columns.map((c) => (
                <td key={c.header} className={`px-3 py-3 first:pl-0 last:pr-0 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Definition list of label/value pairs. */
export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,40%)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Row of filter buttons (status tabs). */
export function FilterTabs<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: string; count?: number | null }[];
  value: V;
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`label shrink-0 border px-3 py-2 transition-colors ${value === o.value ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2 hover:border-ink'}`}
        >
          {o.label}
          {o.count !== undefined && o.count !== null ? <span className="ml-1.5 opacity-70">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Label + control + hint/error. Pass the control's id as `id`. */
export function Field({ id, label, hint, error, children, className = '' }: { id: string; label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Small button sizes for dense screens; combine with .btn-primary / .btn-secondary. */
export const btnSm = 'btn min-h-9 px-4';

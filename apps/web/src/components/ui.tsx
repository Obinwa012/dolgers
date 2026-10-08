import Link from 'next/link';
import { type Tone, toneFor } from '@/lib/format.ts';

const TONE: Record<Tone, string> = {
  good: 'bg-good-bg text-good',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  neutral: 'bg-mist text-ink-soft',
};

export function Badge({ children, tone, status }: { children: React.ReactNode; tone?: Tone; status?: string }) {
  const t = tone ?? (status ? toneFor(status) : 'neutral');
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${TONE[t]}`}>{children}</span>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-4xl uppercase">{title}</h1>
        {sub && <p className="mt-2 max-w-3xl text-ink-soft">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, children, className = '', action }: { title?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-line bg-paper ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: Tone }) {
  const body = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`display tabular mt-1 text-4xl ${tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : ''}`}>{value}</div>
    </>
  );
  const cls = 'block rounded-lg border border-line bg-paper px-4 py-3';
  return href ? (
    <Link href={href} className={`${cls} hover:border-denim`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-stitch bg-paper/60 px-6 py-10 text-center text-ink-soft">{children}</div>;
}

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number; key: string }[]; current: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-line" aria-label="Filter">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${t.key === current ? 'border-denim text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular ml-1.5 text-xs text-ink-soft">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-md bg-ink px-3.5 py-2 text-sm font-semibold text-paper hover:bg-denim-deep disabled:opacity-40',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-paper px-3.5 py-2 text-sm font-semibold text-ink hover:border-ink disabled:opacity-40',
  danger: 'inline-flex items-center justify-center gap-2 rounded-md border border-bad/30 bg-paper px-3.5 py-2 text-sm font-semibold text-bad hover:bg-bad-bg disabled:opacity-40',
  link: 'font-semibold text-denim underline-offset-2 hover:underline',
};

export const input =
  'w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-stitch focus:border-denim focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

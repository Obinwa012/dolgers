import Link from 'next/link';
import type { ReactNode } from 'react';

/** Eyebrow + display title + optional right-hand link, as on the mockup's home sections. */
export function SectionHeading({ eyebrow, title, link, as: Tag = 'h2' }: { eyebrow?: string; title: string; link?: { label: string; href: string }; as?: 'h1' | 'h2' }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
        {eyebrow ? <p className="label mb-3 text-muted">{eyebrow}</p> : null}
        <Tag className="display text-[34px] md:text-[44px]">{title}</Tag>
      </div>
      {link ? <Link href={link.href} className="link-underline shrink-0">{link.label}</Link> : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {item.href ? <Link href={item.href} className="hover:text-ink">{item.label}</Link> : <span aria-current="page" className="text-ink">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = { info: 'bg-stone text-ink', error: 'bg-[#f7ebe8] text-danger', success: 'bg-[#e9f1ea] text-success' }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border border-faint border-t-ink" aria-hidden />
      {label}
    </span>
  );
}

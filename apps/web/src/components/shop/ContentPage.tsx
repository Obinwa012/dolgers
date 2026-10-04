import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/ui';

/** Layout for help and company pages: breadcrumbs, heading, intro, then simple prose. */
export function ContentPage({
  eyebrow,
  title,
  intro,
  crumbs,
  children,
  note,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  children?: ReactNode;
  /** A short line flagging what the owner still has to confirm before launch. */
  note?: ReactNode;
}) {
  return (
    <div className="container-page pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, ...(crumbs ?? []), { label: title }]} />
      <div className="mx-auto max-w-3xl pb-8">
        <header className="mt-10 border-b border-line pb-10 md:mt-14">
          {eyebrow ? <p className="label text-muted">{eyebrow}</p> : null}
          <h1 className="display mt-4 text-[44px] md:text-[60px]">{title}</h1>
          {intro ? <div className="mt-5 text-[16px] leading-relaxed text-muted">{intro}</div> : null}
        </header>
        <div className="mt-10">{children}</div>
        {note ? <p className="mt-14 border-t border-line pt-5 text-xs leading-relaxed text-faint">{note}</p> : null}
      </div>
    </div>
  );
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-line py-8 first:pt-0 last:border-b-0">
      <h2 className="display text-[26px] md:text-[30px]">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

export function Table({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink">
            {head.map((h) => (
              <th key={h} scope="col" className="label py-3 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="py-3 pr-4 font-medium">{c}</th>
                ) : (
                  <td key={j} className="py-3 pr-4 text-ink-2">{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn, Field, input } from '@/components/ui.tsx';
import { type CopyEdit, saveProductCopy } from '@/server/actions/catalog.ts';

export function CopyEditor({ id, initial, price, shipping, material }: { id: string; initial: CopyEdit; price: string; shipping: string; material: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold leading-snug">{initial.title}</h2>
          <button className={btn.secondary} onClick={() => setEditing(true)}>Edit copy</button>
        </div>
        <p className="tabular mt-1 text-lg font-semibold">{price}</p>
        <p className="text-sm text-ink-soft">{shipping}{material ? ` · ${material}` : ''}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5">{initial.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
        <div className="mt-4 space-y-2">{initial.description.map((d) => <p key={d}>{d}</p>)}</div>
        {initial.faq.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Questions</h3>
            <dl className="space-y-2">
              {initial.faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="text-ink-soft">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    );
  }

  const lines = (s: string) => s.split('\n');
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        start(async () => {
          const r = await saveProductCopy(id, v);
          if (!r.ok) setError(r.error);
          else {
            setEditing(false);
            router.refresh();
          }
        });
      }}
    >
      <Field label="Title" hint={`${v.title.length} characters`}>
        <input className={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </Field>
      <Field label="Bullets" hint="One per line">
        <textarea className={`${input} min-h-32`} value={v.bullets.join('\n')} onChange={(e) => setV({ ...v, bullets: lines(e.target.value) })} />
      </Field>
      <Field label="Description" hint="One paragraph per line">
        <textarea className={`${input} min-h-32`} value={v.description.join('\n')} onChange={(e) => setV({ ...v, description: lines(e.target.value) })} />
      </Field>
      <Field label="FAQ" hint="Question on one line, answer on the next, blank line between pairs">
        <textarea
          className={`${input} min-h-40`}
          value={v.faq.map((f) => `${f.q}\n${f.a}`).join('\n\n')}
          onChange={(e) =>
            setV({
              ...v,
              faq: e.target.value.split(/\n\s*\n/).map((block) => {
                const [q = '', ...a] = block.split('\n');
                return { q, a: a.join(' ') };
              }),
            })
          }
        />
      </Field>
      <Field label="SEO title" hint={`${v.seoTitle.length} / 60 characters`}>
        <input className={input} value={v.seoTitle} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} />
      </Field>
      <Field label="Meta description" hint={`${v.metaDescription.length} / 155 characters`}>
        <textarea className={input} value={v.metaDescription} onChange={(e) => setV({ ...v, metaDescription: e.target.value })} />
      </Field>
      <p className="text-xs text-ink-soft">Only state what the evidence supports: no “Made in USA”, brand names or claims buyers didn’t confirm.</p>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btn.primary} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" className={btn.secondary} onClick={() => { setV(initial); setEditing(false); }}>Cancel</button>
      </div>
    </form>
  );
}

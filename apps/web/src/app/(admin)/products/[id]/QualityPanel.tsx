'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn, Field, input } from '@/components/ui.tsx';
import type { QualityEvent } from '@/core/firestore/model.ts';
import { recordQuality } from '@/server/actions/catalog.ts';

const KINDS: { kind: QualityEvent['kind']; label: string }[] = [
  { kind: 'orders', label: 'Orders' },
  { kind: 'refund', label: 'Refund' },
  { kind: 'complaint', label: 'Complaint' },
  { kind: 'dispute', label: 'Payment dispute' },
];

/** Record what happened with your own customers; the rules pause or flag the product. */
export function QualityPanel({ id, categories }: { id: string; categories: { key: string; label: string; bucket: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<QualityEvent['kind']>('orders');
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const r = await recordQuality(id, { kind, count, category: kind === 'complaint' ? category : null, note });
          if (!r.ok) setMsg({ ok: false, text: r.error });
          else {
            setMsg({ ok: true, text: r.notes.join(' · ') || 'Recorded.' });
            setNote('');
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="What happened">
        {KINDS.map((k) => (
          <button type="button" key={k.kind} role="radio" aria-checked={kind === k.kind} onClick={() => setKind(k.kind)} className={kind === k.kind ? btn.primary : btn.secondary}>
            {k.label}
          </button>
        ))}
      </div>
      {(kind === 'orders' || kind === 'refund') && (
        <Field label={kind === 'orders' ? 'How many orders' : 'How many refunds'}>
          <input className={input} type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </Field>
      )}
      {kind === 'complaint' && (
        <Field label="What was wrong" hint="Unfixable problems (C) pause the product at once.">
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Choose</option>
            {['C', 'B', 'A'].map((b) => (
              <optgroup key={b} label={b === 'C' ? 'Can’t be fixed (pauses)' : b === 'B' ? 'Customer service absorbs' : 'Listing should prevent'}>
                {categories.filter((c) => c.bucket === b).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      )}
      <Field label="Note" hint="Order number, what the customer said.">
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      <button className={btn.secondary} disabled={pending}>{pending ? 'Saving…' : 'Record'}</button>
    </form>
  );
}

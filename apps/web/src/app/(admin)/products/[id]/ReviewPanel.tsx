'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn, Field, input } from '@/components/ui.tsx';
import type { ReviewChecks } from '@/core/firestore/model.ts';
import { DELETE_REASONS } from '@/lib/format.ts';
import { type CheckKey, deleteProduct, productAction, setReviewCheck } from '@/server/actions/catalog.ts';

const CHECKS: { key: CheckKey; label: string; hint: string }[] = [
  { key: 'reverseImage', label: 'Reverse image search done, and the photos aren’t another brand’s', hint: 'Use the Lens and TinEye buttons under each photo.' },
  { key: 'noBrandResemblance', label: 'The design doesn’t resemble a known brand', hint: 'Check Claude’s resemblance flag, if any, yourself.' },
  { key: 'listingRead', label: 'Listing text read, and the size chart makes sense', hint: 'Below: listing, size guide and variants.' },
];

/** The three checks, then Publish or Delete with a reason. */
export function ReviewPanel({ id, checks, canPublish, probation }: { id: string; checks: ReviewChecks | null; canPublish: boolean; probation: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Record<CheckKey, boolean>>({
    reverseImage: !!checks?.reverseImage,
    noBrandResemblance: !!checks?.noBrandResemblance,
    listingRead: !!checks?.listingRead,
  });
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const all = CHECKS.every((c) => state[c.key]);

  const tick = (key: CheckKey, value: boolean) => {
    setState((s) => ({ ...s, [key]: value }));
    start(async () => {
      const r = await setReviewCheck(id, key, value);
      if (!r.ok) {
        setError(r.error);
        setState((s) => ({ ...s, [key]: !value }));
      }
    });
  };

  return (
    <div>
      {probation && (
        <p className="mb-3 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">
          Probation product: fewer buyers than a full import. Take a slower look at the reviews and buyer photos.
        </p>
      )}
      <ul className="space-y-2">
        {CHECKS.map((c) => (
          <li key={c.key}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4" checked={state[c.key]} disabled={pending} onChange={(e) => tick(c.key, e.target.checked)} />
              <span>
                <span className="font-semibold">{c.label}</span>
                <span className="block text-xs text-ink-soft">{c.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {canPublish && (
          <button
            className={btn.primary}
            disabled={!all || pending}
            title={all ? undefined : 'Tick all three checks first'}
            onClick={() =>
              start(async () => {
                setError('');
                const r = await productAction(id, 'approve');
                if (!r.ok) setError(r.error);
                else router.refresh();
              })
            }
          >
            Publish
          </button>
        )}
        <button className={btn.danger} onClick={() => setDeleting((d) => !d)}>Delete…</button>
      </div>
      {deleting && (
        <form
          className="mt-4 space-y-3 rounded-md border border-bad/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError('');
              const r = await deleteProduct(id, reason, note);
              if (!r.ok) setError(r.error);
              else router.push('/products?status=deleted');
            });
          }}
        >
          <Field label="Why are you deleting it?" hint="Reasons are reviewed monthly; ones that keep coming up become rules.">
            <select className={input} value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Choose a reason</option>
              {DELETE_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Note" hint={reason === 'Other' ? 'Required for “Other”.' : 'Optional: what exactly you saw.'}>
            <textarea className={input} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button className={btn.danger} disabled={pending || !reason}>Delete product</button>
        </form>
      )}
    </div>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import { RETURN_WINDOW_DAYS, type ReturnRequest, type VendorOrder } from '@dolgers/shared';
import { Notice } from '@/components/ui';
import { useNow } from '@/components/checkout/useNow';
import { accountApi, errorMessage } from '@/lib/firebase/api';

const REASONS = ['It does not fit', 'Not as described', 'Arrived damaged or faulty', 'Changed my mind', 'Something else'];
const DAY = 86_400_000;

/** Return request for one shipped parcel. The server re-checks quantities, ownership and the window. */
export function ReturnRequestForm({ vo, returns }: { vo: VendorOrder; returns: ReturnRequest[] }) {
  const now = useNow(60_000);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (vo.status !== 'shipped') return null;

  const already = new Map<string, number>();
  for (const r of returns) {
    if (r.status === 'rejected') continue;
    for (const l of r.lines) already.set(l.sku, (already.get(l.sku) ?? 0) + l.quantity);
  }
  const returnable = vo.lines
    .map((l) => ({ line: l, max: l.quantity - (already.get(l.sku) ?? 0) }))
    .filter((x) => x.max > 0);
  const closesAt = (vo.shippedAt ?? vo.createdAt) + (RETURN_WINDOW_DAYS + 7) * DAY;

  if (sent) {
    return <div className="mt-5"><Notice tone="success">Your return request is with {vo.vendorName}. They will email you instructions, usually within two working days.</Notice></div>;
  }
  if (now > closesAt) {
    return <p className="mt-5 border-t border-line pt-4 text-xs text-muted">The {RETURN_WINDOW_DAYS}-day return window for this parcel has closed.</p>;
  }
  if (!returnable.length) return null;

  if (!open) {
    return (
      <div className="mt-5 border-t border-line pt-4">
        <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(true)} aria-expanded={false}>
          Request a return
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([sku, quantity]) => ({ sku, quantity }));
    if (!lines.length) return setError('Choose at least one piece to return.');
    if (!reason) return setError('Tell us why you are returning it.');
    const full = details.trim() ? `${reason}: ${details.trim()}` : reason;
    setBusy(true);
    try {
      await accountApi({ action: 'requestReturn', data: { vendorOrderId: vo.id, lines, reason: full.slice(0, 500) } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const idBase = `ret-${vo.id}`;
  return (
    <form onSubmit={submit} className="mt-5 space-y-5 border-t border-line pt-5" noValidate>
      <fieldset>
        <legend className="label">Pieces to return</legend>
        <ul className="mt-3 space-y-3">
          {returnable.map(({ line, max }) => {
            const value = qty[line.sku] ?? 0;
            return (
              <li key={line.sku} className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ink"
                    checked={value > 0}
                    onChange={(e) => setQty({ ...qty, [line.sku]: e.target.checked ? 1 : 0 })}
                  />
                  {line.title} · {line.size}
                </label>
                {max > 1 && value > 0 ? (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Qty
                    <select
                      className="field min-h-0 w-16 py-1"
                      value={value}
                      onChange={(e) => setQty({ ...qty, [line.sku]: Number(e.target.value) })}
                    >
                      {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div>
        <label htmlFor={`${idBase}-reason`} className="field-label">Reason</label>
        <select id={`${idBase}-reason`} className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idBase}-details`} className="field-label">Anything the maker should know? (optional)</label>
        <textarea id={`${idBase}-details`} className="field" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={400} />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send return request'}</button>
        <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="text-xs text-muted">Returns are accepted within {RETURN_WINDOW_DAYS} days of delivery. Refunds go back to your original payment method once the maker receives the pieces.</p>
    </form>
  );
}

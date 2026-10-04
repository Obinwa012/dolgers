'use client';

import { collection, orderBy, query } from 'firebase/firestore';
import { useState } from 'react';
import { formatMoney, promoInputSchema, type PromoCode, type PromoType } from '@dolgers/shared';
import { centsToInput, formatDate, fromDateInput, parseDollars, toDateInput } from '@/components/dashboard/format';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { MoneyInput } from '@/components/dashboard/MoneyInput';
import { DataTable, EmptyState, ErrorText, Field, Loading, PageHeader, Panel, StatusBadge, SuccessText, btnSm } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

interface PromoForm {
  code: string;
  type: PromoType;
  value: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  active: boolean;
}

const BLANK: PromoForm = { code: '', type: 'percent', value: '', minSubtotal: '', startsAt: '', endsAt: '', maxRedemptions: '', active: true };

function fromPromo(p: PromoCode): PromoForm {
  return {
    code: p.code,
    type: p.type,
    value: p.type === 'percent' ? String(p.value) : centsToInput(p.value),
    minSubtotal: p.minSubtotal ? centsToInput(p.minSubtotal) : '',
    startsAt: toDateInput(p.startsAt),
    endsAt: toDateInput(p.endsAt),
    maxRedemptions: p.maxRedemptions ? String(p.maxRedemptions) : '',
    active: p.active,
  };
}

function describe(p: PromoCode) {
  return p.type === 'percent' ? `${p.value}% off` : `${formatMoney(p.value)} off`;
}

function promoState(p: PromoCode, now: number): { label: string; tone: 'good' | 'neutral' | 'warn' | 'bad' } {
  if (!p.active) return { label: 'Paused', tone: 'neutral' };
  if (p.endsAt && p.endsAt < now) return { label: 'Ended', tone: 'neutral' };
  if (p.startsAt && p.startsAt > now) return { label: 'Scheduled', tone: 'warn' };
  if (p.maxRedemptions && p.redemptions >= p.maxRedemptions) return { label: 'Used up', tone: 'bad' };
  return { label: 'Active', tone: 'good' };
}

function PromoEditor({ initial, editing, onDone }: { initial: PromoForm; editing: boolean; onDone: () => void }) {
  const [form, setForm] = useState<PromoForm>(initial);
  const action = useAction();
  const set = <K extends keyof PromoForm>(k: K, v: PromoForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const value = form.type === 'percent' ? Number.parseInt(form.value, 10) : parseDollars(form.value);
    const min = form.minSubtotal ? parseDollars(form.minSubtotal) : 0;
    const max = form.maxRedemptions ? Number.parseInt(form.maxRedemptions, 10) : null;
    if (value === null || !Number.isFinite(value)) return action.setError(form.type === 'percent' ? 'Enter a percentage.' : 'Enter an amount in dollars.');
    if (min === null) return action.setError('Minimum order must be an amount in dollars.');
    const startsAt = fromDateInput(form.startsAt);
    const endsAt = fromDateInput(form.endsAt, true);
    if (startsAt && endsAt && endsAt < startsAt) return action.setError('The end date is before the start date.');
    const parsed = promoInputSchema.safeParse({ code: form.code, type: form.type, value, minSubtotal: min, active: form.active, startsAt, endsAt, maxRedemptions: max });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return action.setError(issue.path[0] === 'code' ? 'Codes are 3–30 letters, numbers, dashes or underscores.' : issue.message);
    }
    void action.run(async () => {
      await adminApi({ action: 'upsertPromo', data: parsed.data });
      if (!editing) setForm(BLANK);
    }, editing ? `${parsed.data.code} updated.` : `${parsed.data.code} created.`);
  };

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field id="code" label="Code" hint={editing ? 'Codes cannot be renamed.' : 'Shoppers type this at checkout. Letters and numbers.'}>
        <input id="code" className="field uppercase" maxLength={30} value={form.code} readOnly={editing} onChange={(e) => set('code', e.target.value.toUpperCase())} />
      </Field>
      <fieldset>
        <legend className="field-label">Discount</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['percent', 'fixed'] as const).map((t) => (
            <label key={t} className={`label flex min-h-10 cursor-pointer items-center justify-center border ${form.type === t ? 'border-ink bg-ink text-paper' : 'border-line-strong'}`}>
              <input type="radio" name="type" className="sr-only" checked={form.type === t} onChange={() => setForm((f) => ({ ...f, type: t, value: '' }))} />
              {t === 'percent' ? 'Percent' : 'Fixed amount'}
            </label>
          ))}
        </div>
      </fieldset>
      {form.type === 'percent' ? (
        <Field id="value" label="Percent off" hint="Up to 90%.">
          <input id="value" className="field" inputMode="numeric" value={form.value} onChange={(e) => set('value', e.target.value.replace(/\D/g, ''))} />
        </Field>
      ) : (
        <Field id="value" label="Amount off">
          <MoneyInput id="value" value={form.value} onChange={(v) => set('value', v)} />
        </Field>
      )}
      <Field id="min" label="Minimum order (optional)">
        <MoneyInput id="min" value={form.minSubtotal} onChange={(v) => set('minSubtotal', v)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="starts" label="Starts (optional)"><input id="starts" type="date" className="field" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
        <Field id="ends" label="Ends (optional)"><input id="ends" type="date" className="field" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
      </div>
      <Field id="maxRedemptions" label="Maximum uses (optional)">
        <input id="maxRedemptions" className="field" inputMode="numeric" value={form.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value.replace(/\D/g, ''))} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-ink" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        Active
      </label>
      <ErrorText>{action.error}</ErrorText>
      <SuccessText>{action.success}</SuccessText>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={action.pending}>{action.pending ? 'Saving…' : editing ? 'Save code' : 'Create code'}</button>
        {editing ? <button type="button" className="btn btn-secondary" onClick={onDone}>New code</button> : null}
      </div>
    </form>
  );
}

export default function AdminPromosPage() {
  const promos = useLiveQuery<PromoCode>('promoCodes', (db) => query(collection(db, 'promoCodes'), orderBy('createdAt', 'desc')));
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [now] = useState(() => Date.now());

  return (
    <>
      <PageHeader eyebrow="Marketing" title="Promo codes" description="Discounts come out of each maker's share in proportion to their part of the order." />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {promos.error ? <ErrorText>{promos.error}</ErrorText> : promos.loading ? <Loading /> : promos.data.length === 0 ? (
            <EmptyState title="No promo codes yet" body="Create one with the form." />
          ) : (
            <DataTable
              caption="Promo codes"
              rows={promos.data}
              rowKey={(p) => p.code}
              columns={[
                { header: 'Code', cell: (p) => <span className="font-mono font-medium">{p.code}</span> },
                { header: 'Discount', cell: (p) => <div>{describe(p)}{p.minSubtotal ? <p className="text-xs text-muted">Orders over {formatMoney(p.minSubtotal)}</p> : null}</div> },
                { header: 'Dates', cell: (p) => (p.startsAt || p.endsAt ? `${formatDate(p.startsAt)} – ${formatDate(p.endsAt)}` : 'Always') },
                { header: 'Used', align: 'right', cell: (p) => `${p.redemptions}${p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}` },
                { header: 'Status', cell: (p) => { const s = promoState(p, now); return <StatusBadge status="promo" label={s.label} tone={s.tone} />; } },
                { header: '', align: 'right', cell: (p) => <button type="button" className={`${btnSm} btn-secondary`} aria-label={`Edit ${p.code}`} onClick={() => setEditing(p)}>Edit</button> },
              ]}
            />
          )}
        </div>
        <Panel title={editing ? `Edit ${editing.code}` : 'New code'}>
          <PromoEditor key={editing?.code ?? 'new'} initial={editing ? fromPromo(editing) : BLANK} editing={!!editing} onDone={() => setEditing(null)} />
        </Panel>
      </div>
    </>
  );
}

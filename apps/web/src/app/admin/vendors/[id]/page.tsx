'use client';

import { collection, doc, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { Vendor, VendorMember, VendorPrivate } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { bpsToPercent, formatDate, formatDateTime, percentToBps } from '@/components/dashboard/format';
import { useAction, useCount, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { stripeLabel } from '@/components/dashboard/stripe';
import { ErrorText, Field, KeyValue, Loading, PageHeader, Panel, StatusBadge, SuccessText } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

function CommissionForm({ vendorId, current }: { vendorId: string; current: number }) {
  const [value, setValue] = useState(bpsToPercent(current));
  const action = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const bps = percentToBps(value);
        if (bps === null || bps > 5000) {
          action.setError('Commission must be a percentage from 0 to 50.');
          return;
        }
        void action.run(() => adminApi({ action: 'updateVendor', data: { vendorId, commissionBps: bps } }), 'Commission updated. It applies to new orders.');
      }}
    >
      <Field id="commission" label="Commission (%)">
        <div className="flex gap-2">
          <input id="commission" className="field" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className="btn btn-primary min-h-12 shrink-0 px-5" disabled={action.pending}>Save</button>
        </div>
      </Field>
      <ErrorText>{action.error}</ErrorText>
      <SuccessText>{action.success}</SuccessText>
    </form>
  );
}

export default function AdminVendorPage() {
  const { id } = useParams<{ id: string }>();
  const vendor = useLiveDoc<Vendor>(`vendor:${id}`, (db) => doc(db, 'vendors', id));
  const priv = useLiveDoc<VendorPrivate>(`vendorPrivate:${id}`, (db) => doc(db, 'vendorPrivate', id));
  const members = useLiveQuery<VendorMember>(`members:${id}`, (db) => collection(db, 'vendors', id, 'members'));
  const live = useCount(`live:${id}`, (db) => query(collection(db, 'products'), where('vendorId', '==', id), where('status', '==', 'live')));
  const total = useCount(`all:${id}`, (db) => query(collection(db, 'products'), where('vendorId', '==', id)));
  const [confirm, setConfirm] = useState<'suspend' | 'reactivate' | null>(null);
  const toggle = useAction();

  if (vendor.loading || priv.loading) return <Loading />;
  if (vendor.error || !vendor.data) {
    return (
      <>
        <PageHeader title="Vendor" back={{ label: 'Vendors', href: '/admin/vendors' }} />
        <ErrorText>{vendor.error ?? 'Vendor not found.'}</ErrorText>
      </>
    );
  }
  const v = vendor.data;
  const p = priv.data;
  const stripe = stripeLabel(p);

  return (
    <>
      <PageHeader
        back={{ label: 'Vendors', href: '/admin/vendors' }}
        eyebrow={`Joined ${formatDate(v.createdAt)}`}
        title={v.name}
        description={<span className="flex flex-wrap items-center gap-3"><StatusBadge status={v.status} /> {v.tagline}</span>}
        actions={
          <>
            <Link href={`/brands/${v.id}`} className="btn btn-secondary min-h-10">Brand page</Link>
            <Link href={`/admin/products?vendor=${v.id}`} className="btn btn-secondary min-h-10">Products</Link>
            {v.status === 'active' ? (
              <button type="button" className="btn min-h-10 border border-danger text-danger hover:bg-danger hover:text-paper" onClick={() => setConfirm('suspend')}>Suspend</button>
            ) : (
              <button type="button" className="btn btn-primary min-h-10" onClick={() => setConfirm('reactivate')}>Reactivate</button>
            )}
          </>
        }
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Store">
          <KeyValue
            items={[
              ['Vendor id', <code key="id" className="text-xs">{v.id}</code>],
              ['Departments', v.departments.map((d) => (d === 'men' ? 'Men' : 'Boys')).join(', ') || '—'],
              ['Products', `${live ?? '—'} live of ${total ?? '—'}`],
              ['Followers', v.followerCount ?? 0],
              ['Ships from', v.facts?.shipsFrom || '—'],
              ['Dispatch', v.facts?.dispatchDays ? `${v.facts.dispatchDays[0]}–${v.facts.dispatchDays[1]} working days` : '—'],
              ['Updated', formatDateTime(v.updatedAt)],
            ]}
          />
        </Panel>
        <Panel title="Payments" actions={<StatusBadge status="stripe" label={stripe.label} tone={stripe.tone} />}>
          {priv.error ? <ErrorText>{priv.error}</ErrorText> : p ? (
            <div className="space-y-6">
              <KeyValue
                items={[
                  ['Contact email', p.contactEmail],
                  ['Stripe account', p.stripeAccountId ? <code key="s" className="text-xs">{p.stripeAccountId}</code> : '—'],
                  ['Details submitted', p.detailsSubmitted ? 'Yes' : 'No'],
                  ['Charges enabled', p.chargesEnabled ? 'Yes' : 'No'],
                  ['Payouts enabled', p.payoutsEnabled ? 'Yes' : 'No'],
                ]}
              />
              <CommissionForm key={p.commissionBps} vendorId={v.id} current={p.commissionBps} />
              <div className="flex items-start justify-between gap-4 border-t border-line pt-5">
                <div>
                  <p id="auto-label" className="text-sm font-medium">Auto-approve products</p>
                  <p className="text-xs text-muted">Products from this vendor go live without review.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.autoApprove}
                  aria-labelledby="auto-label"
                  disabled={toggle.pending}
                  onClick={() => void toggle.run(() => adminApi({ action: 'updateVendor', data: { vendorId: v.id, autoApprove: !p.autoApprove } }))}
                  className={`relative h-6 w-11 shrink-0 border transition-colors ${p.autoApprove ? 'border-ink bg-ink' : 'border-line-strong bg-stone'}`}
                >
                  <span className={`absolute top-0.5 h-[18px] w-[18px] bg-paper transition-all ${p.autoApprove ? 'left-[22px]' : 'left-0.5'}`} aria-hidden />
                </button>
              </div>
              <ErrorText>{toggle.error}</ErrorText>
            </div>
          ) : <p className="text-sm text-muted">No private record for this vendor.</p>}
        </Panel>
        <Panel title="Team" className="lg:col-span-2">
          {members.data.length === 0 ? <p className="text-sm text-muted">No members.</p> : (
            <ul className="divide-y divide-line text-sm">
              {members.data.map((m) => (
                <li key={m.uid} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{m.email}</span>
                  <span className="text-muted">{m.role === 'owner' ? 'Owner' : 'Staff'} · added {formatDate(m.addedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <ConfirmDialog
        open={confirm === 'suspend'}
        title={`Suspend ${v.name}?`}
        body="Their live products come off sale straight away and they can't make changes. Reactivating the store does not relist products: each one has to be approved again."
        confirmLabel="Suspend store"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await adminApi({ action: 'updateVendor', data: { vendorId: v.id, status: 'suspended' } }); }}
      />
      <ConfirmDialog
        open={confirm === 'reactivate'}
        title={`Reactivate ${v.name}?`}
        body="The store and brand page come back. Suspended products stay hidden until you approve each one again from Products."
        confirmLabel="Reactivate"
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await adminApi({ action: 'updateVendor', data: { vendorId: v.id, status: 'active' } }); }}
      />
    </>
  );
}

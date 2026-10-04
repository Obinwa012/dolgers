'use client';

import { doc } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_COMMISSION_BPS, type VendorApplication } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { bpsToPercent, formatDateTime, percentToBps } from '@/components/dashboard/format';
import { useAction, useLiveDoc } from '@/components/dashboard/hooks';
import { ErrorText, Field, KeyValue, Loading, PageHeader, Panel, StatusBadge, SuccessText } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
    </div>
  );
}

export default function AdminApplicationPage() {
  const { uid } = useParams<{ uid: string }>();
  const app = useLiveDoc<VendorApplication>(`application:${uid}`, (db) => doc(db, 'vendorApplications', uid));
  const [commission, setCommission] = useState(bpsToPercent(DEFAULT_COMMISSION_BPS));
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const approve = useAction();

  if (app.loading) return <Loading />;
  if (app.error || !app.data) {
    return (
      <>
        <PageHeader title="Application" back={{ label: 'Applications', href: '/admin/applications' }} />
        <ErrorText>{app.error ?? 'Application not found.'}</ErrorText>
      </>
    );
  }
  const a = app.data;
  const bps = percentToBps(commission);
  const website = a.website && a.website.startsWith('https://') ? a.website : null;
  const instagram = a.instagram.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');

  return (
    <>
      <PageHeader
        back={{ label: 'Applications', href: '/admin/applications' }}
        eyebrow={`Applied ${formatDateTime(a.createdAt)}`}
        title={a.businessName}
        description={<StatusBadge status={a.status} />}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <Panel title="About the label">
            <Paragraphs text={a.description} />
          </Panel>
          <Panel title="Details">
            <KeyValue
              items={[
                ['Contact', a.contactName],
                ['Email', <a key="e" href={`mailto:${a.email}`} className="underline underline-offset-4">{a.email}</a>],
                ['Website', website ? <a key="w" href={website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{website}</a> : '—'],
                ['Instagram', instagram ? <a key="i" href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">@{instagram}</a> : '—'],
                ['Departments', a.departments.map((d) => (d === 'men' ? 'Men' : 'Boys')).join(', ')],
                ['Ships from', a.shipsFrom],
                ...(a.reviewedAt ? [['Reviewed', formatDateTime(a.reviewedAt)] as [string, string]] : []),
                ...(a.reviewNote ? [['Review note', a.reviewNote] as [string, string]] : []),
              ]}
            />
          </Panel>
        </div>
        <div>
          {a.status === 'pending' ? (
            <Panel title="Decision">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (bps === null || bps > 5000) {
                    approve.setError('Commission must be a percentage from 0 to 50.');
                    return;
                  }
                  void approve.run(() => adminApi({ action: 'reviewApplication', data: { uid: a.uid, approve: true, note: note.trim(), commissionBps: bps } }), 'Approved. We have emailed the label.');
                }}
              >
                <Field id="commission" label="Commission (%)" hint="The share DOLGERS keeps from each sale. Default is 15%.">
                  <input id="commission" className="field" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
                </Field>
                <Field id="note" label="Internal note (optional)">
                  <textarea id="note" className="field min-h-[88px]" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <ErrorText>{approve.error}</ErrorText>
                <button type="submit" className="btn btn-primary w-full" disabled={approve.pending}>{approve.pending ? 'Approving…' : 'Approve and create store'}</button>
                <button type="button" className="btn btn-secondary w-full" disabled={approve.pending} onClick={() => setRejecting(true)}>Reject</button>
              </form>
            </Panel>
          ) : (
            <Panel title="Decision">
              <SuccessText>{approve.success}</SuccessText>
              <p className="text-sm text-ink-2">
                {a.status === 'approved' ? 'This label has a store.' : 'This application was not approved. The applicant may apply again.'}
              </p>
              {a.vendorId ? <Link href={`/admin/vendors/${a.vendorId}`} className="link-underline mt-4 inline-block">Open vendor</Link> : null}
            </Panel>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={rejecting}
        title={`Reject ${a.businessName}?`}
        body="We'll email the applicant. Your note is included in the email, so keep it kind and specific."
        confirmLabel="Reject"
        danger
        note={{ label: 'Note to the applicant' }}
        onClose={() => setRejecting(false)}
        onConfirm={async (n) => { await adminApi({ action: 'reviewApplication', data: { uid: a.uid, approve: false, note: n } }); }}
      />
    </>
  );
}

'use client';

import { collection, limit, query, where } from 'firebase/firestore';
import { useState } from 'react';
import type { AuditEntry } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { formatDateTime } from '@/components/dashboard/format';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { ErrorText, Field, PageHeader, Panel, SuccessText } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

export default function AdminTeamPage() {
  const { email: myEmail } = useDashboard();
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState<{ email: string; admin: boolean } | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);
  const changes = useLiveQuery<AuditEntry>('audit:setAdmin', (db) => query(collection(db, 'auditLog'), where('action', '==', 'admin.setAdmin'), limit(100)));
  const history = [...changes.data].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  const action = useAction();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <>
      <PageHeader eyebrow="Settings" title="Team and search" description="Who can open this console, and the search index behind the store." />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Admin access">
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="admin-email" label="Email address" hint="The person must already have a DOLGERS account. They need to sign out and back in to see the change.">
              <input id="admin-email" type="email" autoComplete="off" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <ErrorText>{action.error}</ErrorText>
            <SuccessText>{action.success}</SuccessText>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => setConfirm({ email: email.trim(), admin: true })}>Grant admin</button>
              <button type="button" className="btn btn-secondary" disabled={!valid || email.trim().toLowerCase() === myEmail.toLowerCase()} onClick={() => setConfirm({ email: email.trim(), admin: false })}>Revoke admin</button>
            </div>
          </form>
          <div className="mt-8 border-t border-line pt-5">
            <h3 className="label mb-3 text-muted">Recent changes</h3>
            {changes.error ? <ErrorText>{changes.error}</ErrorText> : history.length === 0 ? <p className="text-sm text-muted">No changes recorded yet.</p> : (
              <ul className="divide-y divide-line text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{h.detail.admin ? 'Granted' : 'Revoked'} · {String(h.detail.email ?? h.target)}</span>
                    <span className="text-muted">{formatDateTime(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Search index">
          <p className="text-sm text-ink-2">
            The store&apos;s search runs on Typesense. Products are indexed automatically whenever they change. Rebuild the whole
            index if search results look out of date, after a bulk import, or after changing the index settings.
          </p>
          <button type="button" className="btn btn-secondary mt-5" disabled={reindexing} onClick={() => setReindexing(true)}>Rebuild search index</button>
          {reindexResult ? <div className="mt-4"><SuccessText>{reindexResult}</SuccessText></div> : null}
        </Panel>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.admin ? 'Grant admin access?' : 'Revoke admin access?'}
        body={confirm ? (confirm.admin
          ? <>{confirm.email} will be able to approve vendors, refund orders and change the store.</>
          : <>{confirm.email} will lose access to this console.</>) : null}
        confirmLabel={confirm?.admin ? 'Grant access' : 'Revoke access'}
        danger={!confirm?.admin}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const c = confirm;
          await action.run(async () => {
            await adminApi({ action: 'setAdmin', data: { email: c.email, admin: c.admin } });
            setEmail('');
          }, c.admin ? `${c.email} is now an admin.` : `${c.email} is no longer an admin.`);
        }}
      />
      <ConfirmDialog
        open={reindexing}
        title="Rebuild the search index?"
        body="Every live product is re-sent to Typesense. Search keeps working while it runs; it can take a minute or two."
        confirmLabel="Rebuild"
        onClose={() => setReindexing(false)}
        onConfirm={async () => {
          setReindexResult(null);
          const res = (await adminApi({ action: 'reindexSearch', data: {} })) as { indexed: number };
          setReindexResult(`Rebuilt. ${res.indexed} products indexed.`);
        }}
      />
    </>
  );
}

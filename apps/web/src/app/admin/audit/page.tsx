'use client';

import { collection, limit, orderBy, query } from 'firebase/firestore';
import { useState } from 'react';
import type { AuditEntry } from '@dolgers/shared';
import { formatDateTime } from '@/components/dashboard/format';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, Loading, PageHeader } from '@/components/dashboard/ui';

export default function AdminAuditPage() {
  const [count, setCount] = useState(100);
  const [filter, setFilter] = useState('');
  const log = useLiveQuery<AuditEntry>(`auditLog:${count}`, (db) => query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(count)));
  const f = filter.trim().toLowerCase();
  const rows = f ? log.data.filter((e) => `${e.action} ${e.target} ${e.actorUid}`.toLowerCase().includes(f)) : log.data;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Audit log" description="Every admin action and every product change, newest first. Entries cannot be edited or deleted." />
      <div className="mb-6 max-w-sm">
        <label htmlFor="audit-filter" className="sr-only">Filter entries</label>
        <input id="audit-filter" type="search" className="field" placeholder="Filter by action, target or user id" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {log.error ? <ErrorText>{log.error}</ErrorText> : log.loading && !log.data.length ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No entries" body={f ? 'Nothing matches that filter.' : undefined} />
      ) : (
        <>
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((e) => (
              <li key={e.id} className="grid gap-1 py-3 text-sm md:grid-cols-[180px_220px_1fr] md:gap-4">
                <span className="text-muted tabular-nums">{formatDateTime(e.createdAt)}</span>
                <span className="font-mono text-xs leading-5">{e.action}</span>
                <div className="min-w-0">
                  <p className="break-all"><span className="text-muted">Target</span> {e.target} <span className="text-muted">· by</span> <code className="text-xs">{e.actorUid}</code></p>
                  {e.detail && Object.keys(e.detail).length ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted">Details</summary>
                      <pre className="mt-2 max-h-64 overflow-auto bg-stone p-3 text-xs">{JSON.stringify(e.detail, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {log.data.length >= count ? (
            <button type="button" className="btn btn-secondary mt-6" onClick={() => setCount((c) => c + 100)}>Load older entries</button>
          ) : null}
        </>
      )}
    </>
  );
}

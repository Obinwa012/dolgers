'use client';

import { collection, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Vendor, VendorPrivate } from '@dolgers/shared';
import { bpsToPercent, formatDate } from '@/components/dashboard/format';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { stripeLabel } from '@/components/dashboard/stripe';
import { DataTable, EmptyState, ErrorText, Loading, PageHeader, StatusBadge } from '@/components/dashboard/ui';

export default function AdminVendorsPage() {
  const vendors = useLiveQuery<Vendor>('vendors:all', (db) => query(collection(db, 'vendors'), orderBy('name')));
  const privs = useLiveQuery<VendorPrivate>('vendorPrivate:all', (db) => collection(db, 'vendorPrivate'));
  const [q, setQ] = useState('');
  const privById = useMemo(() => new Map(privs.data.map((p) => [p.vendorId, p])), [privs.data]);
  const rows = vendors.data.filter((v) => !q || `${v.name} ${v.id}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="Marketplace" title="Vendors" description="Every label with a store on DOLGERS." />
      <div className="mb-6 max-w-sm">
        <label htmlFor="vendor-search" className="sr-only">Search vendors</label>
        <input id="vendor-search" type="search" className="field" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {vendors.error ? <ErrorText>{vendors.error}</ErrorText> : vendors.loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No vendors found" body={q ? 'Try a different search.' : 'Approve an application to create the first store.'} />
      ) : (
        <DataTable
          caption="Vendors"
          rows={rows}
          rowKey={(v) => v.id}
          columns={[
            { header: 'Vendor', cell: (v) => <div><Link href={`/admin/vendors/${v.id}`} className="font-medium underline-offset-4 hover:underline">{v.name}</Link><p className="text-xs text-muted">{privById.get(v.id)?.contactEmail ?? v.id}</p></div> },
            { header: 'Products', align: 'right', cell: (v) => v.productCount ?? 0 },
            { header: 'Commission', align: 'right', cell: (v) => { const p = privById.get(v.id); return p ? `${bpsToPercent(p.commissionBps)}%` : '—'; } },
            { header: 'Stripe', cell: (v) => { const s = stripeLabel(privById.get(v.id)); return <StatusBadge status="stripe" label={s.label} tone={s.tone} />; } },
            { header: 'Auto-approve', cell: (v) => (privById.get(v.id)?.autoApprove ? 'On' : 'Off') },
            { header: 'Joined', cell: (v) => formatDate(v.createdAt) },
            { header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
          ]}
        />
      )}
    </>
  );
}

'use client';

import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useState } from 'react';
import type { VendorApplication } from '@dolgers/shared';
import { formatDate } from '@/components/dashboard/format';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { DataTable, EmptyState, ErrorText, FilterTabs, Loading, PageHeader, StatusBadge } from '@/components/dashboard/ui';

type Tab = 'pending' | 'reviewed';

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const apps = useLiveQuery<VendorApplication>(`applications:${tab}`, (db) =>
    tab === 'pending'
      ? query(collection(db, 'vendorApplications'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'vendorApplications'), where('status', 'in', ['approved', 'rejected']), orderBy('createdAt', 'desc'), limit(200)));

  return (
    <>
      <PageHeader eyebrow="Vendors" title="Applications" description="Labels that have asked to sell on DOLGERS. Approving one creates their store and emails them a link to the vendor dashboard." />
      <FilterTabs<Tab> label="Applications" value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending' }, { value: 'reviewed', label: 'Reviewed' }]} />
      {apps.error ? <ErrorText>{apps.error}</ErrorText> : apps.loading ? <Loading /> : apps.data.length === 0 ? (
        <EmptyState title={tab === 'pending' ? 'No applications waiting' : 'Nothing reviewed yet'} body={tab === 'pending' ? 'New applications from the Sell With Us page appear here.' : undefined} />
      ) : (
        <DataTable
          caption="Applications"
          rows={apps.data}
          rowKey={(a) => a.uid}
          columns={[
            {
              header: 'Label',
              cell: (a) => (
                <div>
                  <Link href={`/admin/applications/${a.uid}`} className="font-medium underline-offset-4 hover:underline">{a.businessName}</Link>
                  <p className="max-w-md truncate text-xs text-muted">{a.description}</p>
                </div>
              ),
            },
            { header: 'Contact', cell: (a) => <div>{a.contactName}<p className="text-xs text-muted">{a.email}</p></div> },
            { header: 'Departments', cell: (a) => a.departments.map((d) => (d === 'men' ? 'Men' : 'Boys')).join(', ') },
            { header: 'Ships from', cell: (a) => a.shipsFrom },
            { header: 'Applied', cell: (a) => formatDate(a.createdAt) },
            { header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
          ]}
        />
      )}
    </>
  );
}

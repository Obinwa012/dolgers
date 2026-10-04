'use client';

import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { useState } from 'react';
import type { VendorOrder, VendorOrderStatus } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, FilterTabs, Loading, PageHeader } from '@/components/dashboard/ui';
import { VendorOrderTable } from '@/components/dashboard/VendorOrderTable';

type Filter = 'all' | VendorOrderStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'preparing', label: 'To ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'all', label: 'All' },
];

export default function VendorOrdersPage() {
  const { vendorId } = useDashboard();
  const [filter, setFilter] = useState<Filter>('preparing');
  const orders = useLiveQuery<VendorOrder>(`vendorOrders:${vendorId}:${filter}`, (db) =>
    filter === 'all'
      ? query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc'), limit(200))
      : query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), where('status', '==', filter), orderBy('createdAt', 'desc'), limit(200)));

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description="Ship each order from your workshop and add tracking. We pay you as soon as an order is marked as shipped."
      />
      <FilterTabs<Filter> label="Filter by status" value={filter} onChange={setFilter} options={FILTERS} />
      {orders.error ? <ErrorText>{orders.error}</ErrorText> : orders.loading ? <Loading /> : orders.data.length ? (
        <VendorOrderTable orders={orders.data} />
      ) : (
        <EmptyState
          title={filter === 'preparing' ? 'Nothing to ship' : 'No orders here'}
          body={filter === 'preparing' ? "You're all caught up. New orders appear here and we email you as they come in." : 'Try another filter.'}
        />
      )}
    </>
  );
}

'use client';

import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney, type Order, type OrderStatus, type VendorOrder } from '@dolgers/shared';
import { formatDateTime, humanize } from '@/components/dashboard/format';
import { useLiveQuery } from '@/components/dashboard/hooks';
import { DataTable, EmptyState, ErrorText, FilterTabs, Loading, PageHeader, StatusBadge } from '@/components/dashboard/ui';

type Filter = 'all' | OrderStatus | 'blocked';
const STATUSES: OrderStatus[] = ['paid', 'partially_shipped', 'shipped', 'partially_refunded', 'refunded', 'cancelled', 'pending_payment'];

function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <DataTable
      caption="Orders"
      rows={orders}
      rowKey={(o) => o.id}
      columns={[
        { header: 'Order', cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link> },
        { header: 'Placed', cell: (o) => formatDateTime(o.createdAt) },
        { header: 'Customer', cell: (o) => <div>{o.shippingAddress.firstName} {o.shippingAddress.lastName}<p className="text-xs text-muted">{o.email}{o.isGuest ? ' · guest' : ''}</p></div> },
        { header: 'Makers', align: 'right', cell: (o) => o.vendorIds.length },
        { header: 'Total', align: 'right', cell: (o) => formatMoney(o.totals.total) },
        { header: 'Refunded', align: 'right', cell: (o) => (o.refundedTotal ? formatMoney(o.refundedTotal) : '—') },
        { header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
      ]}
    />
  );
}

function BlockedPayouts() {
  const rows = useLiveQuery<VendorOrder>('vendorOrders:blocked', (db) => query(collection(db, 'vendorOrders'), where('payout.status', '==', 'blocked'), limit(200)));
  if (rows.error) return <ErrorText>{rows.error}</ErrorText>;
  if (rows.loading) return <Loading />;
  if (!rows.data.length) return <EmptyState title="No payouts on hold" body="Payouts are held when a vendor ships before finishing Stripe setup." />;
  return (
    <DataTable
      caption="Payouts on hold"
      rows={rows.data}
      rowKey={(o) => o.id}
      columns={[
        { header: 'Order', cell: (o) => <Link href={`/admin/orders/${o.orderId}`} className="font-medium underline-offset-4 hover:underline">{o.orderNumber}</Link> },
        { header: 'Vendor', cell: (o) => <Link href={`/admin/vendors/${o.vendorId}`} className="hover:underline">{o.vendorName}</Link> },
        { header: 'Shipped', cell: (o) => formatDateTime(o.shippedAt) },
        { header: 'Amount', align: 'right', cell: (o) => formatMoney(o.payout.amount) },
      ]}
    />
  );
}

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const term = submitted.trim();
  const byEmail = term.includes('@');

  const orders = useLiveQuery<Order>(filter === 'blocked' ? null : `orders:${filter}:${term}`, (db) => {
    const col = collection(db, 'orders');
    if (term) return byEmail ? query(col, where('email', '==', term.toLowerCase()), limit(100)) : query(col, where('number', '==', term.toUpperCase()), limit(10));
    if (filter === 'all') return query(col, orderBy('createdAt', 'desc'), limit(100));
    return query(col, where('status', '==', filter), orderBy('createdAt', 'desc'), limit(100));
  });
  const rows = term ? [...orders.data].sort((a, b) => b.createdAt - a.createdAt) : orders.data;

  return (
    <>
      <PageHeader eyebrow="Sales" title="Orders" description="Every order across the marketplace. Open one to see each maker's part, refund it or retry a payout." />
      <form
        role="search"
        className="mb-6 flex max-w-lg gap-2"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(search); }}
      >
        <label htmlFor="order-search" className="sr-only">Find an order by number or customer email</label>
        <input id="order-search" type="search" className="field" placeholder="Order number or customer email" value={search}
          onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setSubmitted(''); }} />
        <button type="submit" className="btn btn-primary shrink-0 px-5">Find</button>
      </form>
      {!term ? (
        <FilterTabs<Filter>
          label="Filter orders"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'Recent' }, ...STATUSES.map((s) => ({ value: s as Filter, label: s === 'pending_payment' ? 'Unpaid' : humanize(s) })), { value: 'blocked', label: 'Payouts on hold' }]}
        />
      ) : null}
      {filter === 'blocked' && !term ? <BlockedPayouts /> : orders.error ? <ErrorText>{orders.error}</ErrorText> : orders.loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No orders found" body={term ? 'Check the order number or email and try again.' : 'Try another filter.'} />
      ) : (
        <OrdersTable orders={rows} />
      )}
    </>
  );
}

'use client';

import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { formatMoney, type Order } from '@dolgers/shared';
import { formatDateTime } from '@/components/dashboard/format';
import { useCount, useLiveQuery } from '@/components/dashboard/hooks';
import { DataTable, EmptyState, ErrorText, Loading, PageHeader, Stat, StatusBadge } from '@/components/dashboard/ui';

const LINKS = [
  { href: '/admin/applications', title: 'Review applications', body: 'New labels waiting to sell on DOLGERS.' },
  { href: '/admin/products', title: 'Review products', body: 'Approve, reject or feature products.' },
  { href: '/admin/orders', title: 'Orders and refunds', body: 'Look up an order, refund, retry a payout.' },
  { href: '/admin/promos', title: 'Promo codes', body: 'Create and pause discount codes.' },
  { href: '/admin/home', title: 'Home page', body: 'Announcement, hero, edit and new arrivals.' },
  { href: '/admin/categories', title: 'Categories', body: 'The menu shoppers browse by.' },
];

export default function AdminOverviewPage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const applications = useCount('apps:pending', (db) => query(collection(db, 'vendorApplications'), where('status', '==', 'pending')));
  const inReview = useCount('products:in_review', (db) => query(collection(db, 'products'), where('status', '==', 'in_review')));
  const ordersToday = useCount(`orders:${today}`, (db) => query(collection(db, 'orders'), where('paidAt', '>=', today)));
  const openReturns = useCount('returns:open', (db) => query(collection(db, 'returns'), where('status', 'in', ['requested', 'approved'])));
  const blocked = useCount('payouts:blocked', (db) => query(collection(db, 'vendorOrders'), where('payout.status', '==', 'blocked')));
  const recent = useLiveQuery<Order>('orders:recent5', (db) => query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(8)));

  return (
    <>
      <PageHeader eyebrow="DOLGERS" title="Admin console" description="What needs attention today across the marketplace." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Applications" value={applications ?? '—'} hint="Waiting for review" href="/admin/applications" />
        <Stat label="Products in review" value={inReview ?? '—'} hint="Submitted by vendors" href="/admin/products" />
        <Stat label="Orders today" value={ordersToday ?? '—'} hint="Paid since midnight" href="/admin/orders" />
        <Stat label="Open returns" value={openReturns ?? '—'} hint="Requested or in transit" />
      </div>
      {blocked ? (
        <p className="mt-4 bg-[#f7ebe8] px-4 py-3 text-sm text-danger">
          {blocked} {blocked === 1 ? 'payout is' : 'payouts are'} on hold because the vendor cannot receive transfers yet.{' '}
          <Link href="/admin/orders" className="underline">Review orders</Link>
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="label mb-4">Quick links</h2>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <li key={l.href} className="bg-paper">
              <Link href={l.href} className="block h-full p-5 transition-colors hover:bg-cream">
                <p className="font-medium">{l.title}</p>
                <p className="mt-1 text-sm text-muted">{l.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="label">Latest orders</h2>
          <Link href="/admin/orders" className="link-underline">All orders</Link>
        </div>
        {recent.error ? <ErrorText>{recent.error}</ErrorText> : recent.loading ? <Loading /> : recent.data.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <DataTable
            caption="Latest orders"
            rows={recent.data}
            rowKey={(o) => o.id}
            columns={[
              { header: 'Order', cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link> },
              { header: 'Placed', cell: (o) => formatDateTime(o.createdAt) },
              { header: 'Customer', cell: (o) => o.email },
              { header: 'Makers', align: 'right', cell: (o) => o.vendorIds.length },
              { header: 'Total', align: 'right', cell: (o) => formatMoney(o.totals.total) },
              { header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
            ]}
          />
        )}
      </section>
    </>
  );
}

'use client';

import Link from 'next/link';
import { formatMoney, type VendorOrder } from '@dolgers/shared';
import { formatDate } from './format';
import { DataTable, StatusBadge } from './ui';

/** Vendor's orders: number, date, customer, items, net, status. */
export function VendorOrderTable({ orders, hrefBase = '/vendor/orders' }: { orders: VendorOrder[]; hrefBase?: string }) {
  return (
    <DataTable
      caption="Orders"
      rows={orders}
      rowKey={(o) => o.id}
      columns={[
        { header: 'Order', cell: (o) => <Link href={`${hrefBase}/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.orderNumber}</Link> },
        { header: 'Placed', cell: (o) => formatDate(o.createdAt) },
        { header: 'Ship to', cell: (o) => `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}, ${o.shippingAddress.city} ${o.shippingAddress.state}` },
        { header: 'Items', align: 'right', cell: (o) => o.lines.reduce((n, l) => n + l.quantity, 0) },
        { header: 'Delivery', cell: (o) => (o.delivery === 'express' ? 'Express' : 'Standard') },
        { header: 'Your net', align: 'right', cell: (o) => formatMoney(o.vendorNet) },
        { header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
      ]}
    />
  );
}

'use client';

import Link from 'next/link';
import { Notice, Spinner } from '@/components/ui';
import { useMyOrders } from './data';
import { OrderList } from './OrderList';

export function OrdersView() {
  const orders = useMyOrders(50);
  return (
    <div>
      <h1 className="display text-[36px] md:text-[44px]">Orders</h1>
      <p className="mt-3 text-sm text-muted">Each maker ships their part of an order separately. Open an order to follow every parcel or request a return.</p>
      <div className="mt-10">
        {orders.loading ? (
          <Spinner label="Loading your orders" />
        ) : orders.error ? (
          <Notice tone="error">{orders.error}</Notice>
        ) : orders.data.length ? (
          <OrderList orders={orders.data} />
        ) : (
          <div className="border-t border-line pt-8">
            <p className="text-sm text-muted">No orders yet.</p>
            <Link href="/new-in" className="btn btn-primary mt-6">Shop new arrivals</Link>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Notice, Spinner } from '@/components/ui';
import { addressOneLine, fullName } from '@/components/checkout/format';
import { useAuth } from '@/context/AuthProvider';
import { useMyAddresses, useMyOrders, useMyProfile } from './data';
import { OrderList } from './OrderList';

export function OverviewView() {
  const { user, claims } = useAuth();
  const profile = useMyProfile();
  const orders = useMyOrders(3);
  const addresses = useMyAddresses();
  const name = profile.data?.firstName || user?.displayName?.split(' ')[0] || '';
  const defaultAddress = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];

  return (
    <div>
      <h1 className="display text-[36px] md:text-[44px]">{name ? `Hello, ${name}` : 'Hello'}</h1>
      <p className="mt-3 text-sm text-muted">Signed in as {user?.email}</p>

      {claims.vendorId ? (
        <div className="mt-8"><Notice>You run a store on DOLGERS. <Link href="/vendor" className="underline underline-offset-2">Open your vendor dashboard</Link>.</Notice></div>
      ) : null}

      <section className="mt-12" aria-labelledby="recent-orders">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 id="recent-orders" className="label">Recent orders</h2>
          <Link href="/account/orders" className="link-underline">View all</Link>
        </div>
        {orders.loading ? (
          <Spinner />
        ) : orders.error ? (
          <Notice tone="error">{orders.error}</Notice>
        ) : orders.data.length ? (
          <OrderList orders={orders.data} />
        ) : (
          <p className="text-sm text-muted">You have not placed an order yet. <Link href="/new-in" className="text-ink underline underline-offset-4">See what is new</Link>.</p>
        )}
      </section>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <section className="border border-line-strong p-6" aria-labelledby="ov-address">
          <h2 id="ov-address" className="label">Default address</h2>
          {addresses.loading ? (
            <div className="mt-4"><Spinner /></div>
          ) : defaultAddress ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-2">{fullName(defaultAddress)}<br />{addressOneLine(defaultAddress)}</p>
          ) : (
            <p className="mt-4 text-sm text-muted">Save an address to check out faster.</p>
          )}
          <Link href="/account/addresses" className="link-underline mt-6 inline-block">Manage addresses</Link>
        </section>
        <section className="border border-line-strong p-6" aria-labelledby="ov-profile">
          <h2 id="ov-profile" className="label">Profile</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            {profile.data ? `${profile.data.firstName} ${profile.data.lastName}`.trim() || user?.email : user?.email}
            <br />
            <span className="text-muted">{profile.data?.marketingOptIn ? 'You receive news of new arrivals and private sales.' : 'You are not subscribed to our emails.'}</span>
          </p>
          <Link href="/account/profile" className="link-underline mt-6 inline-block">Edit profile</Link>
        </section>
      </div>
    </div>
  );
}

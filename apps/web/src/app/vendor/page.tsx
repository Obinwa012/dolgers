'use client';

import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { Check } from 'lucide-react';
import Link from 'next/link';
import type { Vendor, VendorOrder, VendorPrivate } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { useCount, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, Loading, PageHeader, Panel, Stat } from '@/components/dashboard/ui';
import { VendorOrderTable } from '@/components/dashboard/VendorOrderTable';

function ChecklistItem({ done, title, body, href, cta }: { done: boolean; title: string; body: string; href: string; cta: string }) {
  return (
    <li className="flex items-start gap-4 border-b border-line py-4 last:border-b-0">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${done ? 'border-ink bg-ink text-paper' : 'border-line-strong'}`}
        aria-hidden
      >
        {done ? <Check size={14} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? 'text-muted line-through' : ''}`}>
          {title}
          <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted">{body}</p>
      </div>
      {!done ? <Link href={href} className="link-underline shrink-0">{cta}</Link> : null}
    </li>
  );
}

export default function VendorOverviewPage() {
  const { vendorId } = useDashboard();
  const vendor = useLiveDoc<Vendor>(`vendor:${vendorId}`, (db) => doc(db, 'vendors', vendorId));
  const priv = useLiveDoc<VendorPrivate>(`vendorPrivate:${vendorId}`, (db) => doc(db, 'vendorPrivate', vendorId));
  const productCount = useCount(`products:${vendorId}`, (db) => query(collection(db, 'products'), where('vendorId', '==', vendorId)));
  const liveCount = useCount(`live:${vendorId}`, (db) => query(collection(db, 'products'), where('vendorId', '==', vendorId), where('status', '==', 'live')));
  const toShip = useCount(`toShip:${vendorId}`, (db) => query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), where('status', '==', 'preparing')));
  const sales = useCount(`sales:${vendorId}`, (db) =>
    query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), where('status', 'in', ['preparing', 'shipped', 'refunded'])));
  const openReturns = useCount(`returns:${vendorId}`, (db) =>
    query(collection(db, 'returns'), where('vendorId', '==', vendorId), where('status', 'in', ['requested', 'approved'])));
  const recent = useLiveQuery<VendorOrder>(`recent:${vendorId}`, (db) =>
    query(collection(db, 'vendorOrders'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc'), limit(6)));

  if (vendor.loading || priv.loading) return <Loading />;
  if (vendor.error) return <ErrorText>{vendor.error}</ErrorText>;

  const v = vendor.data;
  const p = priv.data;
  const profileDone = !!(v?.tagline && v.story && v.banner?.url);
  const payoutsDone = !!(p?.detailsSubmitted && p.chargesEnabled && p.payoutsEnabled);
  const steps = [profileDone, payoutsDone, (productCount ?? 0) > 0, (sales ?? 0) > 0];
  const remaining = steps.filter((s) => !s).length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={v?.name ?? 'Your store'}
        description={v?.tagline || 'Everything you need to run your store on DOLGERS.'}
        actions={
          <>
            <Link href={`/brands/${vendorId}`} className="btn btn-secondary min-h-10">View storefront</Link>
            <Link href="/vendor/products/new" className="btn btn-primary min-h-10">Add product</Link>
          </>
        }
      />

      {v?.status === 'suspended' ? (
        <div className="mb-8">
          <ErrorText>
            Your store is suspended, so your products are hidden and you can&apos;t make changes. Please contact DOLGERS support.
          </ErrorText>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live products" value={liveCount ?? '—'} href="/vendor/products" />
        <Stat label="Orders to ship" value={toShip ?? '—'} href="/vendor/orders" />
        <Stat label="Open returns" value={openReturns ?? '—'} href="/vendor/returns" />
        <Stat label="Total orders" value={sales ?? '—'} href="/vendor/payouts" />
      </div>

      {remaining > 0 ? (
        <Panel title={`Set up your store · ${4 - remaining} of 4 done`} className="mt-10">
          <ol>
            <ChecklistItem
              done={profileDone}
              title="Tell your story"
              body="Add a tagline, your story and a banner photo. This is what shoppers see on your brand page."
              href="/vendor/storefront"
              cta="Edit storefront"
            />
            <ChecklistItem
              done={payoutsDone}
              title="Set up payouts with Stripe"
              body={
                p?.detailsSubmitted
                  ? 'Stripe is still checking your details. We will pay you as soon as it confirms.'
                  : 'Connect a bank account so we can pay you when your orders ship.'
              }
              href="/vendor/payouts"
              cta="Set up payouts"
            />
            <ChecklistItem
              done={(productCount ?? 0) > 0}
              title="Add your first product"
              body="Photos, sizes, prices and stock. Submit it for review when it's ready."
              href="/vendor/products/new"
              cta="Add product"
            />
            <ChecklistItem
              done={(sales ?? 0) > 0}
              title="Make your first sale"
              body="Once a product is live, orders appear here and we email you straight away."
              href="/vendor/products"
              cta="See products"
            />
          </ol>
        </Panel>
      ) : null}

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="label">Recent orders</h2>
          <Link href="/vendor/orders" className="link-underline">All orders</Link>
        </div>
        {recent.error ? <ErrorText>{recent.error}</ErrorText> : recent.loading ? <Loading /> : recent.data.length ? (
          <VendorOrderTable orders={recent.data} />
        ) : (
          <EmptyState title="No orders yet" body="When someone buys from your store, the order shows up here." />
        )}
      </section>
    </>
  );
}

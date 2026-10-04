'use client';

import { collection, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney, PRODUCT_STATUSES, type Product, type ProductStatus } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { formatDate, humanize } from '@/components/dashboard/format';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { ProductImage } from '@/components/ProductImage';
import { DataTable, EmptyState, ErrorText, FilterTabs, Loading, PageHeader, StatusBadge, SuccessText, btnSm } from '@/components/dashboard/ui';
import { vendorApi } from '@/lib/firebase/api';

type Filter = 'all' | ProductStatus;

export default function VendorProductsPage() {
  const { vendorId } = useDashboard();
  const products = useLiveQuery<Product>(`vendorProducts:${vendorId}`, (db) =>
    query(collection(db, 'products'), where('vendorId', '==', vendorId), orderBy('updatedAt', 'desc')));
  const [filter, setFilter] = useState<Filter>('all');
  const [archiving, setArchiving] = useState<Product | null>(null);
  const action = useAction();

  const counts = Object.fromEntries(PRODUCT_STATUSES.map((s) => [s, products.data.filter((p) => p.status === s).length]));
  const rows = filter === 'all' ? products.data : products.data.filter((p) => p.status === filter);

  const submit = (p: Product) =>
    action.run(
      async () => (await vendorApi({ action: 'submitProduct', data: { productId: p.id } })) as { status: ProductStatus },
      (res) => (res.status === 'live' ? `${p.title} is now live.` : `${p.title} is with our team for review.`),
    );

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Drafts are only visible to you. Submit a product when it's ready and we'll review it, usually within two working days."
        actions={<Link href="/vendor/products/new" className="btn btn-primary min-h-10">Add product</Link>}
      />
      <FilterTabs<Filter>
        label="Filter by status"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: products.data.length },
          ...PRODUCT_STATUSES.map((s) => ({ value: s, label: humanize(s), count: counts[s] })),
        ]}
      />
      <div className="mb-4 space-y-2">
        <ErrorText>{action.error}</ErrorText>
        <SuccessText>{action.success}</SuccessText>
      </div>
      {products.error ? <ErrorText>{products.error}</ErrorText> : products.loading ? <Loading /> : rows.length === 0 ? (
        products.data.length === 0 ? (
          <EmptyState
            title="No products yet"
            body="Add your first piece: photos, sizes, prices and how many you have in stock."
            action={<Link href="/vendor/products/new" className="btn btn-primary">Add product</Link>}
          />
        ) : (
          <EmptyState title={`Nothing ${humanize(filter).toLowerCase()}`} body="Try another filter." />
        )
      ) : (
        <DataTable
          caption="Your products"
          rows={rows}
          rowKey={(p) => p.id}
          columns={[
            {
              header: 'Product',
              cell: (p) => (
                <div className="flex min-w-[240px] gap-3">
                  <ProductImage image={p.images[0]} sizes="48px" className="aspect-[3/4] w-12 shrink-0" showLabel={false} />
                  <div className="min-w-0">
                    <Link href={`/vendor/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.title}</Link>
                    <p className="text-xs text-muted">{p.colour.name} · {p.variants.length} {p.variants.length === 1 ? 'size' : 'sizes'}</p>
                    {(p.status === 'rejected' || p.status === 'suspended') && p.reviewNote ? (
                      <p className="mt-1 text-xs text-danger">Note from DOLGERS: {p.reviewNote}</p>
                    ) : null}
                  </div>
                </div>
              ),
            },
            { header: 'Price', align: 'right', cell: (p) => (p.priceMin === p.priceMax ? formatMoney(p.priceMin) : `${formatMoney(p.priceMin)}–${formatMoney(p.priceMax)}`) },
            { header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
            { header: 'Updated', cell: (p) => formatDate(p.updatedAt) },
            {
              header: 'Actions',
              align: 'right',
              cell: (p) => (
                <div className="flex justify-end gap-2 whitespace-nowrap">
                  <Link href={`/vendor/products/${p.id}`} className={`${btnSm} btn-secondary`}>Edit</Link>
                  {p.status === 'draft' || p.status === 'rejected' || p.status === 'archived' ? (
                    <button type="button" className={`${btnSm} btn-primary`} disabled={action.pending} onClick={() => void submit(p)}>
                      Submit for review
                    </button>
                  ) : null}
                  {p.status !== 'archived' ? (
                    <button type="button" className={`${btnSm} text-muted hover:text-ink`} onClick={() => setArchiving(p)}>Archive</button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
      <ConfirmDialog
        open={!!archiving}
        title="Archive this product?"
        body={archiving ? <>{archiving.title} will be taken off sale. You can submit it again later.</> : null}
        confirmLabel="Archive"
        danger
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          await vendorApi({ action: 'archiveProduct', data: { productId: archiving.id } });
        }}
      />
    </>
  );
}

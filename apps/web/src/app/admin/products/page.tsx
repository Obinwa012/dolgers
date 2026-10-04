'use client';

import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PRODUCT_STATUSES, formatMoney, type Product, type ProductStatus, type Vendor } from '@dolgers/shared';
import { formatDate, humanize } from '@/components/dashboard/format';
import { useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { ProductImage } from '@/components/ProductImage';
import { DataTable, EmptyState, ErrorText, FilterTabs, Loading, PageHeader, StatusBadge } from '@/components/dashboard/ui';

type Filter = ProductStatus | 'all';

export default function AdminProductsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const vendorId = params.get('vendor');
  const [filter, setFilter] = useState<Filter>(vendorId ? 'all' : 'in_review');
  const vendor = useLiveDoc<Vendor>(vendorId ? `vendor:${vendorId}` : null, (db) => doc(db, 'vendors', vendorId!));

  const products = useLiveQuery<Product>(`adminProducts:${vendorId ?? ''}:${vendorId ? '' : filter}`, (db) => {
    const col = collection(db, 'products');
    if (vendorId) return query(col, where('vendorId', '==', vendorId), orderBy('updatedAt', 'desc'));
    if (filter === 'all') return query(col, orderBy('updatedAt', 'desc'), limit(200));
    return query(col, where('status', '==', filter), orderBy('updatedAt', 'desc'), limit(200));
  });
  const rows = vendorId && filter !== 'all' ? products.data.filter((p) => p.status === filter) : products.data;

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title={vendor.data ? `Products · ${vendor.data.name}` : 'Products'}
        description={vendorId ? <button type="button" className="underline underline-offset-4" onClick={() => router.push('/admin/products')}>Show every vendor</button> : 'Review what vendors submit before it goes live. Approved products appear in the store within a minute.'}
      />
      <FilterTabs<Filter>
        label="Filter by status"
        value={filter}
        onChange={setFilter}
        options={[...PRODUCT_STATUSES.map((s) => ({ value: s as Filter, label: s === 'in_review' ? 'Review queue' : humanize(s) })), { value: 'all', label: 'All' }]}
      />
      {products.error ? <ErrorText>{products.error}</ErrorText> : products.loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState title={filter === 'in_review' ? 'The review queue is empty' : 'No products here'} body={filter === 'in_review' ? 'New submissions from vendors appear here.' : 'Try another filter.'} />
      ) : (
        <DataTable
          caption="Products"
          rows={rows}
          rowKey={(p) => p.id}
          columns={[
            {
              header: 'Product',
              cell: (p) => (
                <div className="flex min-w-[240px] gap-3">
                  <ProductImage image={p.images[0]} sizes="48px" className="aspect-[3/4] w-12 shrink-0" showLabel={false} />
                  <div className="min-w-0">
                    <Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.title}</Link>
                    <p className="text-xs text-muted">{p.categoryPath.join(' / ')}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Vendor', cell: (p) => <Link href={`/admin/vendors/${p.vendorId}`} className="hover:underline">{p.vendorName}</Link> },
            { header: 'Price', align: 'right', cell: (p) => (p.priceMin === p.priceMax ? formatMoney(p.priceMin) : `${formatMoney(p.priceMin)}–${formatMoney(p.priceMax)}`) },
            { header: 'Updated', cell: (p) => formatDate(p.updatedAt) },
            { header: 'Status', cell: (p) => <span className="flex flex-wrap gap-1"><StatusBadge status={p.status} />{p.featured ? <StatusBadge status="featured" label="Featured" tone="info" /> : null}</span> },
          ]}
        />
      )}
    </>
  );
}

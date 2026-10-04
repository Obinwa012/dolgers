'use client';

import { collection, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SIZE_LABELS, type InventoryRecord, type Product } from '@dolgers/shared';
import { useDashboard } from '@/components/dashboard/DashboardShell';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, Loading, PageHeader, StatusBadge, SuccessText } from '@/components/dashboard/ui';
import { vendorApi } from '@/lib/firebase/api';

export default function VendorInventoryPage() {
  const { vendorId } = useDashboard();
  const inventory = useLiveQuery<InventoryRecord>(`inventory:${vendorId}`, (db) => query(collection(db, 'inventory'), where('vendorId', '==', vendorId)));
  const products = useLiveQuery<Product>(`vendorProducts:${vendorId}`, (db) =>
    query(collection(db, 'products'), where('vendorId', '==', vendorId), orderBy('updatedAt', 'desc')));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [lowOnly, setLowOnly] = useState(false);
  const action = useAction();

  const groups = useMemo(() => {
    const bySku = new Map(inventory.data.map((r) => [r.sku, r]));
    return products.data
      .filter((p) => p.status !== 'archived')
      .map((p) => {
        const order = SIZE_LABELS[p.sizeSystem];
        const rows = p.variants
          .map((v) => bySku.get(v.sku))
          .filter((r): r is InventoryRecord => !!r)
          .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
        return { product: p, rows };
      })
      .filter((g) => g.rows.length && (!lowOnly || g.rows.some((r) => r.onHand - r.reserved <= 2)));
  }, [inventory.data, products.data, lowOnly]);

  const changed = Object.entries(edits)
    .map(([sku, value]) => ({ sku, onHand: Number.parseInt(value, 10) }))
    .filter(({ sku, onHand }) => {
      const current = inventory.data.find((r) => r.sku === sku);
      return current && Number.isInteger(onHand) && onHand >= 0 && onHand !== current.onHand;
    });
  const invalid = Object.values(edits).some((v) => !/^\d{1,6}$/.test(v));

  const save = () =>
    action.run(async () => {
      for (let i = 0; i < changed.length; i += 100) {
        await vendorApi({ action: 'setStock', data: { items: changed.slice(i, i + 100) } });
      }
      setEdits({});
    }, `Updated stock for ${changed.length} ${changed.length === 1 ? 'size' : 'sizes'}.`);

  const loading = inventory.loading || products.loading;
  const error = inventory.error ?? products.error;

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Inventory"
        description="On hand is what you have on the shelf. Reserved is held for shoppers who are paying right now; it is released if they don't finish."
        actions={
          <button type="button" className="btn btn-primary min-h-10" disabled={!changed.length || invalid || action.pending} onClick={() => void save()}>
            {action.pending ? 'Saving…' : changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'Save changes'}
          </button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Only show products running low (2 or fewer available)
        </label>
        {Object.keys(edits).length ? (
          <button type="button" className="label text-muted hover:text-ink" onClick={() => setEdits({})}>Discard changes</button>
        ) : null}
      </div>
      <div className="mb-4 space-y-2">
        <ErrorText>{action.error ?? (invalid ? 'Stock must be a whole number from 0.' : null)}</ErrorText>
        <SuccessText>{action.success}</SuccessText>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : loading ? <Loading /> : groups.length === 0 ? (
        <EmptyState
          title={lowOnly ? 'Nothing running low' : 'No stock to manage yet'}
          body={lowOnly ? 'Every size has more than two available.' : 'Stock appears here once you add a product with sizes.'}
          action={lowOnly ? undefined : <Link href="/vendor/products/new" className="btn btn-primary">Add product</Link>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <caption className="sr-only">Stock by product and size</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="label py-3 pr-3 font-medium text-muted">Size</th>
                <th scope="col" className="label px-3 py-3 font-medium text-muted">SKU</th>
                <th scope="col" className="label px-3 py-3 text-right font-medium text-muted">Reserved</th>
                <th scope="col" className="label px-3 py-3 text-right font-medium text-muted">Available</th>
                <th scope="col" className="label py-3 pl-3 text-right font-medium text-muted">On hand</th>
              </tr>
            </thead>
            {groups.map(({ product, rows }) => (
              <tbody key={product.id}>
                <tr className="border-b border-line bg-cream">
                  <th scope="rowgroup" colSpan={5} className="px-3 py-2.5 text-left font-medium">
                    <span className="flex flex-wrap items-center gap-3">
                      <Link href={`/vendor/products/${product.id}`} className="underline-offset-4 hover:underline">{product.title}</Link>
                      <span className="text-xs font-normal text-muted">{product.colour.name}</span>
                      <StatusBadge status={product.status} />
                    </span>
                  </th>
                </tr>
                {rows.map((r) => {
                  const value = edits[r.sku] ?? String(r.onHand);
                  const onHand = Number.parseInt(value, 10);
                  const available = (Number.isInteger(onHand) ? onHand : r.onHand) - r.reserved;
                  const isEdited = r.sku in edits && value !== String(r.onHand);
                  return (
                    <tr key={r.sku} className="border-b border-line">
                      <td className="py-2 pr-3 pl-3 font-medium">{r.size}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{r.sku}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.reserved}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${available <= 0 ? 'text-danger' : available <= 2 ? 'text-[#6e5320]' : ''}`}>
                        {available <= 0 ? 'Sold out' : available}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <label htmlFor={`onhand-${r.sku}`} className="sr-only">On hand for {product.title}, size {r.size}</label>
                        <input
                          id={`onhand-${r.sku}`}
                          type="number"
                          min={0}
                          max={100000}
                          inputMode="numeric"
                          className={`field ml-auto min-h-9 w-24 text-right tabular-nums ${isEdited ? 'border-ink bg-cream' : ''}`}
                          value={value}
                          onChange={(e) => setEdits((m) => ({ ...m, [r.sku]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </>
  );
}

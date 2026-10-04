'use client';

import { collection, doc, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { formatMoney, type InventoryRecord, type Product, type ProductStatus } from '@dolgers/shared';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';
import { formatDateTime } from '@/components/dashboard/format';
import { useAction, useLiveDoc, useLiveQuery } from '@/components/dashboard/hooks';
import { ProductImage } from '@/components/ProductImage';
import { DataTable, ErrorText, KeyValue, Loading, PageHeader, Panel, StatusBadge, SuccessText } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

function Paragraphs({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-sm text-faint">None</p>;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
    </div>
  );
}

type Dialog = { status: ProductStatus; title: string; body: string; label: string; danger?: boolean; noteRequired?: boolean } | null;

export default function AdminProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = useLiveDoc<Product>(`product:${id}`, (db) => doc(db, 'products', id));
  const vendorId = product.data?.vendorId;
  const inventory = useLiveQuery<InventoryRecord>(vendorId ? `inventory:${vendorId}:${id}` : null, (db) =>
    query(collection(db, 'inventory'), where('vendorId', '==', vendorId), where('productId', '==', id)));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState(0);
  const action = useAction();

  if (product.loading) return <Loading />;
  if (product.error || !product.data) {
    return (
      <>
        <PageHeader title="Product" back={{ label: 'Products', href: '/admin/products' }} />
        <ErrorText>{product.error ?? 'Product not found.'}</ErrorText>
      </>
    );
  }
  const p = product.data;
  const stock = new Map(inventory.data.map((r) => [r.sku, r]));
  const image = p.images[Math.min(selected, Math.max(0, p.images.length - 1))];

  const setStatus = (status: ProductStatus, note: string, featured?: boolean) =>
    adminApi({ action: 'setProductStatus', data: { productId: p.id, status, note, ...(featured === undefined ? {} : { featured }) } });

  return (
    <>
      <PageHeader
        back={{ label: 'Products', href: '/admin/products' }}
        eyebrow={`${p.vendorName} · updated ${formatDateTime(p.updatedAt)}`}
        title={p.title}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} />{p.featured ? <StatusBadge status="featured" label="Featured" tone="info" /> : null}</span>}
        actions={
          <>
            {p.status !== 'live' ? (
              <button type="button" className="btn btn-primary min-h-10" onClick={() => setDialog({ status: 'live', title: 'Approve and publish?', body: `${p.title} goes live in the store and we email ${p.vendorName}.`, label: 'Approve' })}>
                Approve
              </button>
            ) : null}
            {p.status === 'in_review' ? (
              <button type="button" className="btn btn-secondary min-h-10" onClick={() => setDialog({ status: 'rejected', title: 'Send back to the vendor?', body: 'Say what needs to change. The vendor sees your note in their dashboard and by email.', label: 'Reject', danger: true, noteRequired: true })}>
                Reject
              </button>
            ) : null}
            {p.status === 'live' ? (
              <button type="button" className="btn min-h-10 border border-danger text-danger hover:bg-danger hover:text-paper" onClick={() => setDialog({ status: 'suspended', title: 'Suspend this product?', body: 'It comes off sale straight away. The vendor sees your note.', label: 'Suspend', danger: true, noteRequired: true })}>
                Suspend
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary min-h-10"
              aria-pressed={p.featured}
              disabled={action.pending}
              onClick={() => void action.run(() => setStatus(p.status, p.reviewNote, !p.featured), p.featured ? 'No longer featured.' : 'Featured.')}
            >
              {p.featured ? 'Unfeature' : 'Feature'}
            </button>
          </>
        }
      />
      <div className="mb-6 space-y-2">
        <ErrorText>{action.error}</ErrorText>
        <SuccessText>{action.success}</SuccessText>
        {p.reviewNote ? <p className="bg-stone px-4 py-3 text-sm">Review note: {p.reviewNote}</p> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <ProductImage image={image} sizes="(min-width:1024px) 420px, 100vw" className="aspect-[3/4] w-full border border-line" />
          {p.images.length > 1 ? (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {p.images.map((img, i) => (
                <li key={`${img.url}-${i}`}>
                  <button type="button" aria-label={`Show photo ${i + 1}`} aria-pressed={i === selected} onClick={() => setSelected(i)} className={`block w-full border ${i === selected ? 'border-ink' : 'border-line'}`}>
                    <ProductImage image={img} sizes="80px" className="aspect-[3/4] w-full" showLabel={false} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {p.images.length === 0 ? <p className="mt-2 text-sm text-danger">No photos.</p> : null}
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {p.images.map((img, i) => <li key={i}>Photo {i + 1} alt text: {img.alt || <span className="text-danger">missing</span>}</li>)}
          </ul>
        </div>
        <div className="space-y-8">
          <Panel title="Details">
            <KeyValue
              items={[
                ['Vendor', <Link key="v" href={`/admin/vendors/${p.vendorId}`} className="underline underline-offset-4">{p.vendorName}</Link>],
                ['Category', p.categoryPath.join(' / ')],
                ['Colour', <span key="c" className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 border border-line" style={{ background: p.colour.hex }} aria-hidden />{p.colour.name}</span>],
                ['Fit note', p.fitNote || '—'],
                ['Composition', p.composition || '—'],
                ['Care', p.care || '—'],
                ['Published', formatDateTime(p.publishedAt)],
                ...(p.status === 'live' ? [['In store', <Link key="s" href={`/products/${p.slug}`} className="underline underline-offset-4">/products/{p.slug}</Link>] as [string, React.ReactNode]] : []),
              ]}
            />
          </Panel>
          <Panel title="Description"><Paragraphs text={p.description} /></Panel>
          <Panel title="Sizes and stock">
            <DataTable
              caption="Variants"
              rows={p.variants}
              rowKey={(v) => v.sku}
              columns={[
                { header: 'Size', cell: (v) => <span className="font-medium">{v.size}</span> },
                { header: 'SKU', cell: (v) => <code className="text-xs text-muted">{v.sku}</code> },
                { header: 'Price', align: 'right', cell: (v) => formatMoney(v.price) },
                { header: 'Compare at', align: 'right', cell: (v) => (v.compareAtPrice ? formatMoney(v.compareAtPrice) : '—') },
                { header: 'On hand', align: 'right', cell: (v) => stock.get(v.sku)?.onHand ?? '—' },
                { header: 'Reserved', align: 'right', cell: (v) => stock.get(v.sku)?.reserved ?? '—' },
              ]}
            />
          </Panel>
        </div>
      </div>
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        confirmLabel={dialog?.label ?? 'Confirm'}
        danger={dialog?.danger}
        note={dialog && dialog.status !== 'live' ? { label: 'Note to the vendor', required: dialog.noteRequired } : undefined}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => { if (dialog) await setStatus(dialog.status, note); }}
      />
    </>
  );
}

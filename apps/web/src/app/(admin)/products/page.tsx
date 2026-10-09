import Link from 'next/link';
import { Badge, btn, Card, Empty, input, PageHeader, Tabs } from '@/components/ui.tsx';
import type { DeletionDoc, ProductStatus } from '@/core/firestore/model.ts';
import { ago, DECISION_LABEL, money, PRODUCT_STATUS_LABEL, sortSizes, when } from '@/lib/format.ts';
import { db, repo } from '@/server/firebase.ts';
import { PRODUCT_STATUSES, productCounts } from '@/server/queries.ts';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (sp.status === 'deleted') return <DeletedList />;
  const status = (PRODUCT_STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as ProductStatus) : null;
  const q = (sp.q ?? '').trim().toLowerCase();
  const [counts, all] = await Promise.all([productCounts(), repo().listProducts(status ? [status] : PRODUCT_STATUSES)]);
  const products = q ? all.filter((p) => `${p.title} ${p.id} ${p.category} ${p.colors.join(' ')}`.toLowerCase().includes(q)) : all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const qs = (s: string | null) => `/products${s || q ? '?' : ''}${s ? `status=${s}` : ''}${s && q ? '&' : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`;

  return (
    <>
      <PageHeader title="Products" sub="Everything that passed vetting. Nothing goes live by itself: open a product under Needs review, tick the three checks and publish it, or delete it with a reason." />
      <Tabs
        current={status ?? 'all'}
        items={[
          { key: 'all', label: 'All', count: total, href: qs(null) },
          ...PRODUCT_STATUSES.map((s) => ({ key: s, label: PRODUCT_STATUS_LABEL[s]!, count: counts[s], href: qs(s) })),
          { key: 'deleted', label: 'Deleted', href: '/products?status=deleted' },
        ]}
      />
      <form className="mb-4 max-w-sm" action="/products">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={sp.q ?? ''} placeholder="Search title, id, category, colour" className={input} aria-label="Search products" />
      </form>
      {products.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Decision</th>
                <th className="px-3 py-2.5 text-right">Price</th>
                <th className="px-3 py-2.5">Variants</th>
                <th className="px-3 py-2.5">Delivery</th>
                <th className="px-3 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                      {p.images[0] ? <img src={p.images[0].url} alt="" className="size-12 shrink-0 rounded object-cover" /> : <span className="size-12 shrink-0 rounded bg-mist" />}
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-semibold hover:text-denim">{p.title}</span>
                        <span className="block text-xs text-ink-soft">{p.category} · {p.id}</span>
                        {(p.flags?.length ?? 0) > 0 && (
                          <span className={`block text-xs font-semibold ${p.flags!.some((f) => f.urgent) ? 'text-bad' : 'text-warn'}`}>
                            {p.flags!.length} new flag{p.flags!.length === 1 ? '' : 's'}: {p.flags!.at(-1)!.text.slice(0, 80)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><Badge status={p.status}>{PRODUCT_STATUS_LABEL[p.status]}</Badge></td>
                  <td className="px-3 py-2.5"><Badge status={p.decision}>{DECISION_LABEL[p.decision] ?? p.decision}</Badge>{p.probation.active && p.decision !== 'probation' && <span className="ml-1 text-xs text-ink-soft">probation</span>}</td>
                  <td className="tabular px-3 py-2.5 text-right">{p.priceFromCents === p.priceToCents ? money(p.priceFromCents) : `${money(p.priceFromCents)}–${money(p.priceToCents)}`}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">{p.colors.length} colour{p.colors.length === 1 ? '' : 's'} · {sortSizes(p.sizes).join(', ')}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">{p.delivery.minDays ?? '?'}–{p.delivery.maxDays ?? '?'} days</td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">{ago(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          {q ? 'No products match that search.' : total ? 'No products with this status.' : <>No products yet. <Link href="/run" className="font-semibold text-denim underline">Import and vet</Link> to add some.</>}
        </Empty>
      )}
    </>
  );
}


async function DeletedList() {
  const snap = await db().collection('deletions').orderBy('at', 'desc').limit(300).get();
  const rows = snap.docs.map((d) => d.data() as DeletionDoc);
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const counts = new Map<string, number>();
  for (const r of rows) if (r.at >= monthAgo) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Deleted" sub="Products you deleted at review and why. Look through these once a month: a reason that keeps coming up should become a rule in the vetting code." />
      <p className="mb-4 text-sm"><Link href="/products" className={btn.link}>← All products</Link></p>
      <Card title="Last 30 days, by reason" className="mb-6">
        {counts.size ? (
          <ul className="space-y-1 text-sm">
            {[...counts].sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
              <li key={reason} className="flex justify-between gap-4"><span>{reason}</span><span className="tabular font-bold">{n}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nothing deleted in the last 30 days.</p>
        )}
      </Card>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-soft">{when(r.at)}</td>
                  <td className="px-3 py-2.5">
                    {r.title}
                    <span className="block text-xs text-ink-soft">{r.productId} · decision {r.decision}{r.storeId ? ` · store ${r.storeId}` : ''}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.reason}{r.note && <span className="block text-xs text-ink-soft">{r.note}</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Nothing deleted yet.</Empty>
      )}
    </>
  );
}

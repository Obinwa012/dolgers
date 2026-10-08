import { Badge, Empty, PageHeader, Tabs } from '@/components/ui.tsx';
import { ago } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { SellerActions } from './SellerActions.tsx';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Sellers' };

const rating = (x: number | null) => (x === null ? '—' : x.toFixed(1));

export default async function SellersPage({ searchParams }: { searchParams: Promise<{ blocked?: string; store?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [recent, blocked, one] = await Promise.all([
    repo().listSellers(300),
    repo().blockedSellers(),
    sp.store ? repo().getSeller(sp.store) : Promise.resolve(null),
  ]);
  const list = sp.store ? (one ? [one] : []) : sp.blocked ? blocked : recent;

  return (
    <>
      <PageHeader
        title="Sellers"
        sub="Every AliExpress store seen while vetting. Once a store is known to be below the rating bar, its other items are screened out without asking AliExpress again (for 14 days). A seller is blocked automatically after confirmed seller-level problems (fakes, wrong items, China shipping on “US” listings); blocking pauses their live products."
      />
      <Tabs
        current={sp.store ? 'one' : sp.blocked ? 'blocked' : 'all'}
        items={[
          { key: 'all', label: 'Recent', href: '/sellers' },
          { key: 'blocked', label: 'Blocked', count: blocked.length, href: '/sellers?blocked=1' },
          ...(sp.store ? [{ key: 'one', label: `Store ${sp.store}`, href: `/sellers?store=${sp.store}` }] : []),
        ]}
      />
      {list.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2.5">Seller</th>
                <th className="px-3 py-2.5 text-right" title="As described · Communication · Shipping">Ratings</th>
                <th className="px-3 py-2.5 text-right">Vetted</th>
                <th className="px-3 py-2.5 text-right">Rejected</th>
                <th className="px-3 py-2.5">Strikes</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((s) => (
                <tr key={s.storeId} className="align-top">
                  <td className="px-4 py-2.5">
                    <a href={`https://www.aliexpress.com/store/${s.storeId}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-denim">{s.name || s.storeId}</a>
                    <span className="block text-xs text-ink-soft">{s.storeId} · updated {ago(s.updatedAt)}</span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {rating(s.ratings.asDescribed)} · {rating(s.ratings.communication)} · {rating(s.ratings.shipping)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{s.productsVetted}</td>
                  <td className="tabular px-3 py-2.5 text-right">{s.productsRejected}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {Object.entries(s.strikes).filter(([, n]) => n).map(([k, n]) => `${k.replace(/_/g, ' ')} ×${n}`).join(', ') || <span className="text-ink-soft">none</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.blocked ? <Badge tone="bad">Blocked</Badge> : <Badge tone="good">OK</Badge>}
                    {s.blockReasons.length > 0 && <span className="mt-1 block max-w-xs text-xs text-ink-soft">{s.blockReasons.join('; ')}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <SellerActions storeId={s.storeId} blocked={s.blocked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{sp.blocked ? 'No blocked sellers.' : 'No sellers yet. They appear once products are vetted.'}</Empty>
      )}
    </>
  );
}

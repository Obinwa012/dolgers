import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, btn, Card, KV, PageHeader } from '@/components/ui.tsx';
import { ago, bySize, DECISION_LABEL, money, pct, PRODUCT_STATUS_LABEL, when } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { CopyEditor } from './CopyEditor.tsx';
import { ProductActions } from './ProductActions.tsx';
import { currentAdmin, requireAdmin } from '@/server/auth.ts';

const BUCKET: Record<string, string> = {
  A: 'Fixed on the listing',
  B: 'Absorbed by customer service',
  C: 'Can’t be fixed',
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return { title: 'Product' };
  const p = await repo().getProduct((await params).id);
  return { title: p?.title ?? 'Product' };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [p, src, vet] = await Promise.all([repo().getProduct(id), repo().getSourcing(id), repo().getVetting(id)]);
  if (!p) notFound();
  const skuById = new Map((src?.skus ?? []).map((s) => [s.aeSkuId, s]));
  const r = vet?.result;
  const m = r?.metrics;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/products" className={btn.link}>← Products</Link></p>
      <PageHeader
        title={PRODUCT_STATUS_LABEL[p.status] ?? p.status}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Badge status={p.decision}>{DECISION_LABEL[p.decision] ?? p.decision}</Badge>
            {p.probation.active && <Badge tone="warn">Probation: {p.probation.orders}/{p.probation.windowOrders} orders</Badge>}
            <span>{p.id}</span>
            <span>· updated {ago(p.updatedAt)}</span>
            {p.publishedAt && <span>· live since {when(p.publishedAt)}</span>}
          </span>
        }
      >
        <ProductActions id={p.id} status={p.status} supplierUrl={src?.supplierUrl ?? null} />
      </PageHeader>

      {p.holdReasons.length > 0 && (
        <div className="mb-6 rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
          <p className="font-semibold">Why this needs you</p>
          <ul className="mt-1 list-disc pl-5">{p.holdReasons.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Listing" action={<span className="text-xs text-ink-soft">What shoppers will read</span>}>
            {p.images.length > 0 && (
              <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {p.images.map((im, i) => (
                  <a key={im.url} href={im.url} target="_blank" rel="noreferrer" className="block">
                    <img src={im.url} alt={im.alt} title={im.alt} className="aspect-square w-full rounded border border-line object-cover" loading={i > 5 ? 'lazy' : undefined} />
                  </a>
                ))}
              </div>
            )}
            <CopyEditor
              id={p.id}
              initial={{
                title: p.title,
                bullets: p.bullets,
                description: p.description,
                seoTitle: p.seo.title,
                metaDescription: p.seo.metaDescription,
                faq: p.faq,
              }}
              price={p.priceFromCents === p.priceToCents ? money(p.priceFromCents) : `${money(p.priceFromCents)}–${money(p.priceToCents)}`}
              shipping={`${p.freeShipping ? 'Free shipping' : 'Shipping extra'} · arrives in ${p.delivery.minDays ?? '?'}–${p.delivery.maxDays ?? '?'} days`}
              material={p.material}
            />
          </Card>

          {p.sizeChart && (
            <Card title={`Size guide · ${p.sizeChart.fitType}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="py-1.5 pr-3">Size</th>
                      <th className="py-1.5 pr-3">Fits body (in)</th>
                      <th className="py-1.5 pr-3">Garment (in)</th>
                      <th className="py-1.5">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...p.sizeChart.rows].sort(bySize).map((row) => (
                      <tr key={row.size}>
                        <td className="py-1.5 pr-3 font-semibold">{row.usSizeLabel || row.size}</td>
                        <td className="py-1.5 pr-3">{row.fitsBody.map((b) => `${b.measure} ${b.min}–${b.max}`).join(', ')}</td>
                        <td className="py-1.5 pr-3 text-ink-soft">{Object.entries(row.garment).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}</td>
                        <td className="py-1.5"><Badge tone={row.confidence === 'high' ? 'good' : row.confidence === 'medium' ? 'info' : 'warn'}>{row.confidence}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.sizeChart.fitNotes.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{p.sizeChart.fitNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
              {vet?.usSizeChartReasoning && <p className="mt-3 text-xs text-ink-soft">How it was built: {vet.usSizeChartReasoning}</p>}
            </Card>
          )}

          <Card title="Search preview">
            <div className="max-w-xl">
              <p className="truncate text-xs text-good">dolgers.com › {p.category} › {p.handle}</p>
              <p className="truncate text-lg text-denim">{p.seo.title}</p>
              <p className="text-sm text-ink-soft">{p.seo.metaDescription}</p>
            </div>
            <div className="mt-3">
              <KV
                rows={[
                  ['Primary keyword', p.seo.primaryKeyword],
                  ['Other keywords', p.seo.secondaryKeywords.join(', ') || '—'],
                  ['Keyword status', p.seo.keywordStatus],
                  ['Title length', `${p.seo.title.length} / 60`],
                  ['Description length', `${p.seo.metaDescription.length} / 155`],
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Variants and margins">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="py-1.5 pr-2">Variant</th>
                    <th className="py-1.5 pr-2 text-right">Price</th>
                    <th className="py-1.5 pr-2 text-right">Cost</th>
                    <th className="py-1.5 pr-2 text-right">Ship</th>
                    <th className="py-1.5 pr-2 text-right">Profit</th>
                    <th className="py-1.5 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {[...p.variants].sort((a, b) => a.color.localeCompare(b.color) || bySize(a, b)).map((v) => {
                    const s = skuById.get(v.id);
                    const profit = s ? v.priceCents - s.landedCents : null;
                    const drift = s && s.pricedLandedCents && s.landedCents !== s.pricedLandedCents;
                    return (
                      <tr key={v.id} className={v.inStock ? '' : 'text-ink-soft'}>
                        <td className="py-1.5 pr-2">{v.color} / {v.size}{!v.inStock && ' (out)'}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold">{money(v.priceCents)}</td>
                        <td className="py-1.5 pr-2 text-right">{money(s?.costCents)}</td>
                        <td className="py-1.5 pr-2 text-right">{money(s?.shippingCents)}</td>
                        <td className={`py-1.5 pr-2 text-right ${profit !== null && profit < 500 ? 'text-bad' : ''}`}>
                          {money(profit)}
                          {drift && <span className="block text-[11px] text-warn">cost moved, reprice</span>}
                        </td>
                        <td className="py-1.5 text-right">{s?.stock ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {src && (
            <Card title="Sourcing">
              <KV
                rows={[
                  ['Supplier', <a key="s" href={src.supplierUrl} target="_blank" rel="noreferrer" className={btn.link}>{src.storeName || src.storeId} ↗</a>],
                  ['Seller record', <Link key="r" href={`/sellers?store=${src.storeId}`} className={btn.link}>{src.storeId}</Link>],
                  ['AliExpress ids', `${src.aeMainId} (item) · ${src.aeSubId} (feed)`],
                  ['Shipping', src.shipping ? `${src.shipping.carrier} from ${src.shipping.shipFrom ?? '?'} · ${src.shipping.minDays ?? '?'}–${src.shipping.maxDays ?? '?'} days · ${src.shipping.free ? 'free' : money(src.shipping.feeCents)}${src.shipping.tracking ? ' · tracked' : ''}` : '—'],
                  ['Feeds', src.feeds.join(', ') || '—'],
                  ['Last checked', `${when(src.lastCheckedAt)}${src.lastCheck.notes.length ? ` · ${src.lastCheck.notes.join('; ')}` : ''}`],
                ]}
              />
            </Card>
          )}

          {r && m && (
            <Card title="Why this decision" action={<span className="text-xs text-ink-soft">Vetted {when(vet.vettedAt)} · v{vet.version}</span>}>
              <ul className="mb-4 list-disc pl-5 text-sm">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {(
                  [
                    ['Buyers reviewed', m.buyers],
                    ['With written reviews', m.textBuyers],
                    ['US buyers', m.usBuyers],
                    ['Problem rate', `${pct(m.problemRate)}${m.problemRateUpperBound !== null ? ` (≤${pct(m.problemRateUpperBound)})` : ''}`],
                    ['Ships from US', pct(m.usVariantShare, 0)],
                    ['China carriers', pct(m.chinaLogisticsShare, 0)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-canvas px-3 py-2">
                    <div className="text-xs text-ink-soft">{k}</div>
                    <div className="tabular font-bold">{v}</div>
                  </div>
                ))}
              </div>
              {vet.reviewSummary && <p className="mb-4 text-sm"><span className="font-semibold">What buyers say: </span>{vet.reviewSummary}</p>}
              {r.issues.length > 0 && (
                <>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Problems found in reviews</h3>
                  <ul className="mb-4 space-y-2">
                    {r.issues.map((iss) => (
                      <li key={iss.category} className="rounded-md border border-line p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{iss.label}</strong>
                          <Badge tone={iss.bucket === 'A' ? 'info' : iss.bucket === 'B' ? 'warn' : 'bad'}>{BUCKET[iss.bucket]}</Badge>
                          <span className="text-ink-soft">{iss.buyers} buyer{iss.buyers === 1 ? '' : 's'}</span>
                          {!iss.verified && <Badge tone="warn">quote not verified</Badge>}
                        </div>
                        {iss.quotes.slice(0, 2).map((q) => <p key={q} className="mt-1 italic text-ink-soft">“{q}”</p>)}
                        {iss.fix && <p className="mt-1">Fix: {iss.fix}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {r.listingFixes.length > 0 && (
                <>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Applied to the listing</h3>
                  <ul className="mb-4 list-disc pl-5 text-sm">{r.listingFixes.map((x) => <li key={x}>{x}</li>)}</ul>
                </>
              )}
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Checks</h3>
              <ul className="space-y-1 text-sm">
                {r.checks.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <span className={c.pass ? 'text-good' : c.level === 'info' ? 'text-ink-soft' : c.level === 'reject' ? 'text-bad' : 'text-warn'}>{c.pass ? '✓' : c.level === 'info' ? '•' : '✕'}</span>
                    <span><span className="font-semibold">{c.id.replace(/_/g, ' ')}</span> <span className="text-ink-soft">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
              {vet.imageCheck && (
                <p className="mt-4 text-sm">
                  <span className="font-semibold">Photo check: </span>
                  {vet.imageCheck.ipRisk ? <span className="text-bad">possible brand or likeness: {vet.imageCheck.findings.join('; ')}</span> : `no brands or likenesses found in ${vet.imageCheck.checked} photos`}
                </p>
              )}
              {vet.listingProblems.length > 0 && (
                <p className="mt-2 text-sm text-warn">Listing checks: {vet.listingProblems.join('; ')}</p>
              )}
              <p className="mt-4 text-xs text-ink-soft">
                {vet.evidence.length} facts and {vet.claims.length} traced claims back the listing · models {vet.models.fast}
                {vet.models.careful !== vet.models.fast ? ` / ${vet.models.careful}` : ''} ·{' '}
                <Link href={`/database?c=vetting&id=${p.id}`} className={btn.link}>full record</Link>
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

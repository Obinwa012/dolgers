import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, btn, Card, KV, PageHeader } from '@/components/ui.tsx';
import { ISSUE_RULES } from '@/core/vetting/issues.ts';
import { profitCents } from '@/core/vetting/pricing.ts';
import { ago, bySize, DECISION_LABEL, lensUrl, money, pct, PRODUCT_STATUS_LABEL, tineyeUrl, when } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { ClearFlagsButton } from './ClearFlagsButton.tsx';
import { CopyEditor } from './CopyEditor.tsx';
import { ProductActions } from './ProductActions.tsx';
import { QualityPanel } from './QualityPanel.tsx';
import { ReviewPanel } from './ReviewPanel.tsx';
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
  const [p, src, vet, config] = await Promise.all([repo().getProduct(id), repo().getSourcing(id), repo().getVetting(id), repo().loadConfig()]);
  if (!p) notFound();
  const costs = (src?.skus ?? []).map((k) => k.costCents).filter((c) => c > 0);
  const mismatched = new Map((vet?.photoCheck?.mismatches ?? []).map((m) => [m.reviewId, m.detail]));
  const topComplaints = (vet?.result.issues ?? []).filter((i) => i.bucket !== 'A' && i.quotes.length).slice(0, 4);
  const flags = p.flags ?? [];
  const categories = Object.entries(ISSUE_RULES).map(([key, r]) => ({ key, label: r.label, bucket: r.bucket }));
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

      {flags.some((f) => f.urgent) && (
        <div className="mb-4 rounded-lg border border-bad/30 bg-bad-bg px-4 py-3 text-sm font-semibold text-bad">
          {flags.filter((f) => f.urgent).map((f) => <p key={f.text}>{f.text}</p>)}
        </div>
      )}

      {p.status !== 'retired' && (
        <Card title={p.status === 'live' ? 'Review record' : 'Your review'} className="mb-6">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            {(
              [
                ['Buyers', m ? m.buyers : '—'],
                ['Problem rate, 95% upper bound', m?.problemRateUpperBound != null ? `${pct(m.problemRateUpperBound)} (limit ${pct(p.decision === 'probation' ? config.probationMaxUpperBound : config.maxProblemUpperBound)})` : '—'],
                [`Reviews, last ${config.recentDays} days`, m?.recentReviews ?? '—'],
                ['Our price', p.priceFromCents === p.priceToCents ? money(p.priceFromCents) : `${money(p.priceFromCents)}–${money(p.priceToCents)}`],
                ['Supplier’s price on AliExpress', costs.length ? (Math.min(...costs) === Math.max(...costs) ? money(costs[0]) : `${money(Math.min(...costs))}–${money(Math.max(...costs))}`) : '—'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-md bg-canvas px-3 py-2">
                <div className="text-xs text-ink-soft">{k}</div>
                <div className="tabular font-bold">{v}</div>
              </div>
            ))}
          </div>

          {(p.holdReasons.length > 0 || flags.length > 0) && (
            <div className="mb-4 rounded-md border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Flags</p>
                {flags.length > 0 && <ClearFlagsButton id={p.id} />}
              </div>
              <ul className="mt-1 list-disc pl-5">
                {p.holdReasons.map((h) => <li key={h}>{h}</li>)}
                {flags.map((f) => <li key={`${f.at}-${f.text}`}>{f.source === 'monitor' ? 'Monitor' : 'Your customers'}, {when(f.at)}: {f.text}</li>)}
              </ul>
            </div>
          )}

          {topComplaints.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Top complaints</h3>
              <ul className="space-y-1 text-sm">
                {topComplaints.map((i) => (
                  <li key={i.category}>
                    <strong>{i.label}</strong> <span className="text-ink-soft">({i.buyers} buyer{i.buyers === 1 ? '' : 's'})</span>: <span className="italic">“{i.quotes[0]}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Listing photos</h3>
              <div className="grid grid-cols-3 gap-2">
                {p.images.slice(0, 6).map((im) => <Photo key={im.url} url={im.url} alt={im.alt} />)}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                What buyers received {vet?.photoCheck ? `· ${vet.photoCheck.compared} compared by Claude` : ''}
              </h3>
              {vet?.buyerPhotos?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {vet.buyerPhotos.slice(0, 9).map((b) => (
                    <Photo key={b.reviewId} url={b.url} alt={b.text} caption={`${b.stars}★ · ${b.country || '?'} · ${b.date}`} warning={mismatched.get(b.reviewId)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">No buyer photos in the reviews.</p>
              )}
              {vet?.photoCheck?.quality && <p className="mt-2 text-sm"><span className="font-semibold">Fabric and stitching: </span>{vet.photoCheck.quality}</p>}
            </div>
          </div>

          {p.status === 'live' ? (
            <p className="text-sm text-ink-soft">Published {when(p.publishedAt)}{p.review?.by ? ` after checks by ${p.review.by}` : ''}.</p>
          ) : (
            <ReviewPanel id={p.id} checks={p.review ?? null} canPublish={p.status === 'pending_review' || p.status === 'paused'} probation={p.decision === 'probation'} />
          )}
        </Card>
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

          {p.sizeChart && 'columns' in p.sizeChart && (
            <Card title={`Size guide · ${p.sizeChart.label}`}>
              <p className="mb-2 text-sm text-ink-soft">
                {p.sizeChart.fitType} · inches ·{' '}
                {p.sizeChart.measurementType === 'garment' ? 'garment measurements (the item laid flat)' : p.sizeChart.measurementType === 'body' ? 'body measurements the size fits' : 'the supplier doesn’t say whether these measure the garment or the body'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="py-1.5 pr-3">Size</th>
                      {p.sizeChart.columns.map((c) => <th key={c} className="py-1.5 pr-3 capitalize">{c}</th>)}
                      <th className="py-1.5">US buyers say</th>
                    </tr>
                  </thead>
                  <tbody className="tabular divide-y divide-line">
                    {[...p.sizeChart.rows].sort(bySize).map((row) => (
                      <tr key={row.size}>
                        <td className="py-1.5 pr-3 font-semibold">{row.size}</td>
                        {p.sizeChart!.columns.map((c) => <td key={c} className="py-1.5 pr-3">{row.measurements[c] ?? '—'}</td>)}
                        <td className="py-1.5 text-ink-soft">{row.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.sizeChart.fitNotes.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{p.sizeChart.fitNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
              {vet?.usSizeChartReasoning && <p className="mt-3 text-xs text-ink-soft">How the fit advice was built: {vet.usSizeChartReasoning}</p>}
            </Card>
          )}
          {p.sizeChart && !('columns' in p.sizeChart) && (
            <Card title="Size guide">
              <p className="text-sm text-warn">This size guide was built by the old method, which blended in generic US sizing. Re-vet the product to rebuild it from the supplier’s measurements.</p>
            </Card>
          )}
          {!p.sizeChart && <Card title="Size guide"><p className="text-sm text-warn">No supplier size chart was found, so there is no size guide.</p></Card>}

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
                    <th className="py-1.5 pr-2 text-right" title="After the return reserve and payment fees">Profit</th>
                    <th className="py-1.5 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {[...p.variants].sort((a, b) => a.color.localeCompare(b.color) || bySize(a, b)).map((v) => {
                    const s = skuById.get(v.id);
                    const profit = s ? profitCents(v.priceCents, s.landedCents, config.pricing) : null;
                    const drift = s && s.pricedLandedCents && s.landedCents !== s.pricedLandedCents;
                    return (
                      <tr key={v.id} className={v.inStock ? '' : 'text-ink-soft'}>
                        <td className="py-1.5 pr-2">{v.color} / {v.size}{!v.inStock && ' (out)'}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold">{money(v.priceCents)}</td>
                        <td className="py-1.5 pr-2 text-right">{money(s?.costCents)}</td>
                        <td className="py-1.5 pr-2 text-right">{money(s?.shippingCents)}</td>
                        <td className={`py-1.5 pr-2 text-right ${profit !== null && profit < config.pricing.minProfitCents ? 'text-bad' : ''}`}>
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
                    ['Problem rate', `${pct(m.problemRate)}${m.problemRateUpperBound !== null ? ` (95% bound ${pct(m.problemRateUpperBound)})` : ''}`],
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
                  {vet.imageCheck.ipRisk ? <span className="text-bad">possible brand or likeness: {vet.imageCheck.findings.join('; ')}</span> : `no logos, celebrities or characters found in ${vet.imageCheck.checked} photos`}
                  {vet.imageCheck.resemblance && <span className="block text-warn">Design resembles {vet.imageCheck.resemblance.brand}: {vet.imageCheck.resemblance.reason}</span>}
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
          <Card title="Your customers">
            {p.quality ? (
              <p className="mb-3 text-sm">
                {p.quality.orders} orders · {p.quality.refunds} refunds
                {p.quality.orders ? ` (${pct(p.quality.refunds / p.quality.orders, 0)})` : ''} · {p.quality.complaintsC} unfixable and {p.quality.complaintsB} other complaints · {p.quality.disputes} disputes
                {p.probation.active && ` · probation ${p.probation.defects} defects in ${p.probation.orders}/${p.probation.windowOrders} orders`}
              </p>
            ) : (
              <p className="mb-3 text-sm text-ink-soft">Nothing recorded yet. Until orders flow in automatically, record them here: an unfixable complaint pauses the product, a refund rate over {pct(config.maxRefundRate, 0)} (after {config.refundRateMinOrders} orders) pauses it, and a payment dispute flags it for review today.</p>
            )}
            <QualityPanel id={p.id} categories={categories} />
          </Card>
        </div>
      </div>
    </>
  );
}


function Photo({ url, alt, caption, warning }: { url: string; alt: string; caption?: string; warning?: string }) {
  return (
    <figure className="min-w-0">
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={alt} title={alt} loading="lazy" className={`aspect-square w-full rounded border object-cover ${warning ? 'border-bad ring-2 ring-bad' : 'border-line'}`} />
      </a>
      <figcaption className="mt-1 text-[11px] leading-tight">
        {caption && <span className="block text-ink-soft">{caption}</span>}
        {warning && <span className="block text-bad">Doesn’t match: {warning}</span>}
        <span className="flex gap-2">
          <a href={lensUrl(url)} target="_blank" rel="noreferrer" className="font-semibold text-denim underline">Lens</a>
          <a href={tineyeUrl(url)} target="_blank" rel="noreferrer" className="font-semibold text-denim underline">TinEye</a>
        </span>
      </figcaption>
    </figure>
  );
}

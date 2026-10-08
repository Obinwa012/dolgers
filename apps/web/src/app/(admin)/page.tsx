import Link from 'next/link';
import { Badge, btn, Card, Empty, PageHeader, Stat } from '@/components/ui.tsx';
import { ago, money, OUTCOME_LABEL, PRODUCT_STATUS_LABEL } from '@/lib/format.ts';
import { repo } from '@/server/firebase.ts';
import { blockedSellerCount, candidateCounts, productCounts, setupStatus } from '@/server/queries.ts';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Overview' };

export default async function Overview() {
  await requireAdmin();
  const [setup, products, candidates, blocked, jobs, review] = await Promise.all([
    setupStatus(),
    productCounts(),
    candidateCounts(),
    blockedSellerCount(),
    repo().listJobs(6),
    repo().listProducts(['pending_review']),
  ]);
  const now = Date.now();
  const steps = [
    { done: setup.aeKeys, label: 'Add your AliExpress app key and secret', href: '/settings?tab=aliexpress' },
    {
      done: setup.aeConnected,
      label: setup.aeConnected ? `AliExpress connected${setup.aeRefreshable ? ' (renews itself)' : ''}` : 'Connect your AliExpress account',
      href: '/settings?tab=aliexpress',
    },
    { done: setup.claudeKey, label: 'Add your Claude API key', href: '/settings?tab=claude' },
    { done: candidates.new + candidates.published + candidates.rejected + candidates.screened_out > 0, label: 'Import men’s items from the US feeds', href: '/run' },
    { done: products.live + products.pending_review > 0, label: 'Vet the queue', href: '/run' },
  ];
  const ready = steps.every((s) => s.done);
  const running = jobs.find((j) => j.status === 'running');
  const failed = !running && jobs[0]?.status === 'error' ? jobs[0] : null;
  const tokenSoon = setup.aeExpiresAt && !setup.aeRefreshable && setup.aeExpiresAt - now < 6 * 3600e3;

  return (
    <>
      <PageHeader title="Overview" sub="Men’s clothing from US warehouses, vetted against real buyer reviews before anything goes live.">
        <Link href="/run" className={btn.primary}>Import &amp; vet</Link>
      </PageHeader>

      {running && (
        <Link href="/run" className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-denim bg-info-bg px-4 py-3 text-sm">
          <span>
            <Badge status="running">Running</Badge> <strong className="ml-1 capitalize">{running.type}</strong> job · {running.progress.done}
            {running.progress.total ? ` of ${running.progress.total}` : ''} done · last step {ago(running.updatedAt, now)}
          </span>
          <span className="font-semibold text-denim">Open →</span>
        </Link>
      )}
      {failed && (
        <Link href={`/run?job=${failed.id}`} className="mb-6 block rounded-lg border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">
          The last <strong className="capitalize">{failed.type}</strong> job stopped with an error: {failed.error ?? 'unknown error'} <span className="font-semibold underline">Open</span>
        </Link>
      )}
      {tokenSoon && (
        <div className="mb-6 rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
          The AliExpress token expires {ago(setup.aeExpiresAt, now)} and can’t renew itself. <Link className="font-semibold underline" href="/settings?tab=aliexpress">Reconnect AliExpress</Link>.
        </div>
      )}

      {!ready && (
        <Card title="Getting started" className="mb-6">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? 'bg-good text-paper' : 'border border-stitch text-ink-soft'}`}>
                  {s.done ? '✓' : i + 1}
                </span>
                {s.done ? <span className="text-ink-soft">{s.label}</span> : <Link href={s.href} className={btn.link}>{s.label}</Link>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Live" value={products.live} href="/products?status=live" tone="good" />
        <Stat label="Needs your review" value={products.pending_review} href="/products?status=pending_review" tone={products.pending_review ? 'warn' : undefined} />
        <Stat label="Waiting to vet" value={candidates.new} href="/queue?status=new" />
        <Stat label="Blocked sellers" value={blocked} href="/sellers?blocked=1" tone={blocked ? 'bad' : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Needs your review" action={<Link href="/products?status=pending_review" className={btn.link}>All</Link>}>
          {review.length ? (
            <ul className="divide-y divide-line">
              {review.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  {p.images[0] && <img src={p.images[0].url} alt="" className="size-11 shrink-0 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${p.id}`} className="block truncate font-semibold hover:text-denim">{p.title}</Link>
                    <p className="truncate text-xs text-ink-soft">{p.holdReasons[0] ?? PRODUCT_STATUS_LABEL[p.status]}</p>
                  </div>
                  <span className="tabular text-sm">{money(p.priceFromCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing is waiting for you.</Empty>
          )}
        </Card>

        <Card title="Recent jobs" action={<Link href="/run" className={btn.link}>Run</Link>}>
          {jobs.length ? (
            <ul className="divide-y divide-line">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <Badge status={j.status}>{j.status}</Badge>
                  <Link href={`/run?job=${j.id}`} className="font-semibold capitalize hover:text-denim">{j.type}</Link>
                  <span className="text-ink-soft">{ago(j.createdAt, now)}</span>
                  <span className="ml-auto text-xs text-ink-soft">
                    {Object.entries(j.counts)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${OUTCOME_LABEL[k] ?? k} ${v}`)
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No jobs yet. Start with an import.</Empty>
          )}
        </Card>

        <Card title="Queue" action={<Link href="/queue" className={btn.link}>Open</Link>}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {(
              [
                ['Waiting', candidates.new],
                ['Published', candidates.published],
                ['Held', candidates.held],
                ['Not enough data', candidates.insufficient_data],
                ['Screened out', candidates.screened_out],
                ['Rejected', candidates.rejected],
                ['Errors', candidates.error],
                ['Vetting now', candidates.vetting],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-soft">{k}</dt>
                <dd className="tabular text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Catalog">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {(['live', 'pending_review', 'paused', 'retired'] as const).map((s) => (
              <div key={s}>
                <dt className="text-ink-soft">{PRODUCT_STATUS_LABEL[s]}</dt>
                <dd className="tabular text-lg font-bold">{products[s]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn, Card, Field, input } from '@/components/ui.tsx';
import type { VettingConfig } from '@/core/vetting/config.ts';
import { profitCents, retailPriceCents } from '@/core/vetting/pricing.ts';
import { resetDolgers, saveDolgers } from '@/server/actions/settings.ts';

type Kind = 'num' | 'pct' | 'usd' | 'int';
interface Def {
  path: string;
  label: string;
  kind: Kind;
  hint: string;
}

const GROUPS: { title: string; fields: Def[] }[] = [
  {
    title: 'Reviews',
    fields: [
      { path: 'probationMinBuyers', label: 'Buyers needed to vet at all', kind: 'int', hint: 'Unique buyers with reviews on this exact listing. Fewer is “not enough data”, rechecked later.' },
      { path: 'importMinBuyers', label: 'Buyers needed for a full import', kind: 'int', hint: 'Between the two: probation, which needs a strong seller.' },
      { path: 'importMinTextReviews', label: 'Written reviews needed for a full import', kind: 'int', hint: 'Stars alone can’t tell us what went wrong.' },
      { path: 'minRecentReviews', label: 'Recent reviews needed', kind: 'int', hint: 'Reviews written in the recent window below; shows the product as it’s made now.' },
      { path: 'recentDays', label: 'Recent window (days)', kind: 'int', hint: '' },
    ],
  },
  {
    title: 'Problem rates',
    fields: [
      { path: 'maxProblemUpperBound', label: 'Customer-service problems: upper bound limit', kind: 'pct', hint: '95% upper bound on the share of buyers with a problem. At 5%: 52 buyers with none, about 87 with one.' },
      { path: 'probationMaxUpperBound', label: 'Same limit for probation products', kind: 'pct', hint: 'At 5%, probation needs 52+ buyers with no problems. 12% lets 20 problem-free buyers through.' },
      { path: 'systemicRejectBuyers', label: 'Unfixable problem: buyers to reject', kind: 'int', hint: 'Fewer flags it for you. Fake tracking, IP and safety reject on one report.' },
      { path: 'systemicRejectShare', label: '…and more than this share of buyers', kind: 'pct', hint: '' },
      { path: 'recentProblemRatio', label: 'Flag when the recent problem rate is this many times the overall rate', kind: 'num', hint: 'Catches quality going down.' },
    ],
  },
  {
    title: 'Fake reviews (flags)',
    fields: [
      { path: 'fakeReviews.burstShare', label: 'Share of reviews on the 3 busiest days', kind: 'pct', hint: '' },
      { path: 'fakeReviews.duplicateReviews', label: 'Near-identical reviews', kind: 'int', hint: '' },
      { path: 'fakeReviews.noText5StarShare', label: 'Share of ratings that are 5★ with no text', kind: 'pct', hint: '' },
    ],
  },
  {
    title: 'Seller',
    fields: [
      { path: 'minStoreRating', label: 'Lowest store rating', kind: 'num', hint: 'Each of the three AliExpress store ratings, out of 5.' },
      { path: 'strongSellerRating', label: 'Strong seller rating (needed for probation)', kind: 'num', hint: 'All three at or above this.' },
    ],
  },
  {
    title: 'US shipping',
    fields: [
      { path: 'minUsVariantShare', label: 'Reviews that must say “Ships from United States”', kind: 'pct', hint: 'Catches “US” listings that really ship from China.' },
      { path: 'maxChinaLogisticsShare', label: 'Most reviews shipped by a China carrier', kind: 'pct', hint: '' },
      { path: 'maxDeliveryDays', label: 'Flag delivery promises longer than (days)', kind: 'int', hint: '' },
      { path: 'suspiciousShippingMaxFeeCents', label: 'Suspicious “Priority” fee at or under', kind: 'usd', hint: 'Cheap “Priority” shipping on a cheap item is a red flag…' },
      { path: 'suspiciousShippingMaxItemCents', label: '…on an item priced at or under', kind: 'usd', hint: '' },
    ],
  },
  {
    title: 'Pricing',
    fields: [
      { path: 'pricing.profitCents', label: 'Profit per item prices are set from', kind: 'usd', hint: 'Price = (cost + return reserve + profit + fixed fee) ÷ (1 − fee rate), rounded up to $X.99.' },
      { path: 'pricing.minProfitCents', label: 'Minimum profit before Monitor pauses', kind: 'usd', hint: 'When the supplier’s cost rises this far.' },
      { path: 'pricing.returnReserveRate', label: 'Return reserve', kind: 'pct', hint: 'Of (cost + return shipping) set aside per sale.' },
      { path: 'pricing.returnShippingCents', label: 'Return shipping in the reserve', kind: 'usd', hint: '' },
      { path: 'pricing.paymentFeeRate', label: 'Payment fee rate', kind: 'pct', hint: '' },
      { path: 'pricing.paymentFeeFixedCents', label: 'Payment fee per order', kind: 'usd', hint: '' },
    ],
  },
  {
    title: 'Your orders',
    fields: [
      { path: 'maxRefundRate', label: 'Pause when the refund rate passes', kind: 'pct', hint: '' },
      { path: 'refundRateMinOrders', label: '…once a product has this many orders', kind: 'int', hint: 'One of your customers reporting an unfixable problem pauses it at once.' },
    ],
  },
  {
    title: 'Rechecks',
    fields: [{ path: 'recheckAfterDays', label: 'Look again at “not enough data” items after (days)', kind: 'int', hint: '' }],
  },
];

const get = (o: unknown, path: string): number => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o) as number;
function set<T>(o: T, path: string, v: unknown): T {
  const copy = structuredClone(o) as Record<string, unknown>;
  const keys = path.split('.');
  let cur = copy;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys.at(-1)!] = v;
  return copy as T;
}
const toDisplay = (v: number, k: Kind) => (k === 'pct' ? +(v * 100).toFixed(2) : k === 'usd' ? +(v / 100).toFixed(2) : v);
const fromDisplay = (v: number, k: Kind) => (k === 'pct' ? v / 100 : k === 'usd' ? Math.round(v * 100) : v);

export function DolgersSettings({
  config,
  defaults,
  feeds,
  defaultFeeds,
  importPages,
}: {
  config: VettingConfig;
  defaults: VettingConfig;
  feeds: string[];
  defaultFeeds: string[];
  importPages: number;
}) {
  const router = useRouter();
  const [c, setC] = useState(config);
  const [feedText, setFeedText] = useState(feeds.join('\n'));
  const [blockText, setBlockText] = useState(config.ipBlocklist.join(', '));
  const [pages, setPages] = useState(importPages);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setMsg(null);
      const r = await saveDolgers({
        config: { ...c, ipBlocklist: blockText.split(/[,\n]/) },
        feeds: feedText.split('\n'),
        importPages: pages,
      });
      setMsg(r.ok ? { ok: true, text: 'Saved. New rules apply to the next items vetted.' } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="max-w-5xl space-y-6">
      <p className="text-ink-soft">These are the rules every product must pass. Changing them affects the next items vetted, not products already decided.</p>
      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <div className="grid gap-4 md:grid-cols-2">
            {g.fields.map((f) => {
              const d = get(defaults, f.path);
              return (
                <Field key={f.path} label={f.label} hint={`${f.hint}${f.hint ? ' ' : ''}Default ${f.kind === 'usd' ? '$' : ''}${toDisplay(d, f.kind)}${f.kind === 'pct' ? '%' : ''}.`}>
                  <input
                    className={input}
                    type="number"
                    step="any"
                    value={toDisplay(get(c, f.path), f.kind)}
                    onChange={(e) => setC(set(c, f.path, fromDisplay(Number(e.target.value), f.kind)))}
                  />
                </Field>
              );
            })}
            {g.title === 'Pricing' && (
              <p className="self-end pb-2 text-sm">
                Example: <span className="tabular font-semibold">$13.00</span> cost →{' '}
                <span className="tabular font-semibold">${(retailPriceCents(1300, c.pricing) / 100).toFixed(2)}</span>, profit{' '}
                <span className="tabular font-semibold">${(profitCents(retailPriceCents(1300, c.pricing), 1300, c.pricing) / 100).toFixed(2)}</span>
              </p>
            )}
            {g.title === 'Pricing' && (
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
                <input type="checkbox" checked={c.pricing.freeShipping} onChange={(e) => setC(set(c, 'pricing.freeShipping', e.target.checked))} />
                Free shipping (shipping is built into the price)
              </label>
            )}
          </div>
        </Card>
      ))}
      <Card title="Brands and names we never sell">
        <Field label="Blocked words" hint="Comma separated. A title containing one, or a near-miss spelling of a brand name (Addidas, Carhart), is rejected. Note that “inspired” also blocks phrases like “vintage-inspired”.">
          <textarea className={`${input} min-h-32 font-mono text-xs`} value={blockText} onChange={(e) => setBlockText(e.target.value)} />
        </Field>
      </Card>
      <Card title="Import">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="AliExpress feeds" hint={`One per line. Men’s clothing (category 200000343) only is imported from each. Defaults: ${defaultFeeds.length} US-warehouse feeds.`}>
            <textarea className={`${input} min-h-28 font-mono text-xs`} value={feedText} onChange={(e) => setFeedText(e.target.value)} />
          </Field>
          <Field label="Pages per feed by default" hint="About 50 items per page.">
            <input className={input} type="number" min={1} max={50} value={pages} onChange={(e) => setPages(Number(e.target.value))} />
          </Field>
        </div>
      </Card>
      {msg && <p role="status" className={`rounded-md px-4 py-2 text-sm ${msg.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{msg.text}</p>}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button className={btn.primary} disabled={pending}>{pending ? 'Saving…' : 'Save rules'}</button>
        <button
          type="button"
          className={btn.secondary}
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Put every rule back to its default?')) return;
            start(async () => {
              const r = await resetDolgers();
              if (r.ok) {
                setC(defaults);
                setBlockText(defaults.ipBlocklist.join(', '));
                setFeedText(defaultFeeds.join('\n'));
                setPages(5);
                setMsg({ ok: true, text: 'Back to defaults.' });
                router.refresh();
              } else setMsg({ ok: false, text: r.error });
            });
          }}
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

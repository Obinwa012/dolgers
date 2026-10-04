'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formatMoney, type LineProblem } from '@dolgers/shared';
import { ProductImage } from '@/components/ProductImage';
import { Notice, Spinner } from '@/components/ui';
import { useBag, type BagLine } from '@/context/BagProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { groupByVendor, plural } from './format';
import { TotalsRows } from './OrderSummary';
import { QuantityStepper } from './QuantityStepper';
import { bagNotice, savedPromo } from './storage';
import { useQuote } from './useQuote';

export function BagView({ drawer = false }: { drawer?: boolean }) {
  const { lines, count, hydrated, setQuantity, remove } = useBag();
  const { has, toggle } = useWishlist();
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const code = savedPromo.get();
    const flash = bagNotice.take();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    if (code) { setPromo(code); setPromoInput(code); }
    if (flash) setNotice(flash);
  }, []);

  const ordered = useMemo(() => groupByVendor(lines).flatMap((g) => g.lines), [lines]);
  const { quote, loading, error } = useQuote(lines, 'standard', promo, hydrated && lines.length > 0);

  // Remember a code that worked so checkout starts with it; forget one that did not.
  useEffect(() => {
    if (!quote?.promo) return;
    savedPromo.set(quote.promo.applied ? quote.promo.code : null);
  }, [quote]);

  const priced = useMemo(() => new Map(quote?.lines.map((l) => [l.sku, l]) ?? []), [quote]);
  const problems = useMemo(() => new Map(quote?.problems.map((p) => [p.sku, p]) ?? []), [quote]);
  const bagProblems = lines.filter((l) => problems.has(l.sku));
  const makers = new Set(lines.map((l) => l.vendorId)).size;

  if (!hydrated) {
    return (
      <div className={drawer ? 'px-6 py-16 md:px-8' : 'container-page py-24'}>
        <Spinner label="Loading your bag" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={drawer ? 'px-6 py-10 md:px-8' : 'container-page py-16 md:py-24'}>
        <h1 className="display text-[40px] md:text-[56px]">Your Bag</h1>
        <div className="mt-8 border-t border-ink pt-12">
          {notice ? <div className="mb-8"><Notice tone="error">{notice}</Notice></div> : null}
          <p className="text-lg">Your bag is empty.</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Pieces you add will wait here while you browse. Every order ships directly to you, with complimentary delivery and 14-day returns.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/shop/men" className="btn btn-primary">Shop men</Link>
            <Link href="/shop/boys" className="btn btn-secondary">Shop boys</Link>
          </div>
        </div>
      </div>
    );
  }

  const applyPromo = (e: FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    setPromo(code || null);
    if (!code) savedPromo.set(null);
  };

  const clearPromo = () => {
    setPromo(null);
    setPromoInput('');
    savedPromo.set(null);
  };

  const moveToWishlist = async (line: BagLine) => {
    try {
      if (!has(line.productId)) await toggle(line.productId);
      remove(line.sku);
      setStatus(`${line.title} moved to your wishlist.`);
    } catch {
      setStatus('We could not save that piece to your wishlist. Please try again.');
    }
  };

  const totals = quote?.totals;
  const canCheckout = !!quote && !loading && bagProblems.length === 0 && quote.lines.length > 0;

  return (
    <div className={drawer ? 'px-6 py-8 md:px-8' : 'container-page py-10 md:py-16'}>
      <div className="flex items-end justify-between gap-6 border-b border-ink pb-6">
        <h1 className="display text-[40px] md:text-[56px]">Your Bag</h1>
        <p className="text-sm text-muted">{plural(count, 'item')}</p>
      </div>

      <p className="sr-only" aria-live="polite">{status}</p>

      <div className={drawer ? 'grid gap-8' : 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-16'}>
        <section aria-label="Items in your bag">
          {notice ? <div className="mt-6"><Notice tone="error">{notice}</Notice></div> : null}
          {error ? <div className="mt-6"><Notice tone="error">{error}</Notice></div> : null}
          <ul>
            {ordered.map((line) => (
              <BagRow
                key={line.sku}
                line={line}
                lineTotal={priced.get(line.sku)?.lineTotal ?? null}
                unitPrice={priced.get(line.sku)?.unitPrice ?? line.price}
                problem={problems.get(line.sku) ?? null}
                onQuantity={(q) => setQuantity(line.sku, q)}
                onRemove={() => { remove(line.sku); setStatus(`${line.title} removed from your bag.`); }}
                onMove={() => void moveToWishlist(line)}
              />
            ))}
          </ul>
          <div className="mt-8">
            <Link href="/" className="link-underline">Continue shopping</Link>
          </div>
        </section>

        <aside aria-label="Order summary" className="self-start bg-stone p-6 md:p-9 lg:sticky lg:top-28 lg:mt-2">
          <h2 className="display text-[30px]">Order summary</h2>
          <div className="mt-7">
            <TotalsRows
              rows={[
                { label: 'Subtotal', value: totals ? formatMoney(totals.subtotal) : '—' },
                ...(totals && totals.discount > 0
                  ? [{ label: `Promo ${quote?.promo?.code ?? ''}`.trim(), value: `−${formatMoney(totals.discount)}` }]
                  : []),
                { label: 'Delivery', value: 'Complimentary' },
                { label: 'Estimated tax', value: 'Calculated at checkout', muted: true },
              ]}
              total={{ label: 'Total', value: totals ? formatMoney(totals.total) : '—' }}
            />
          </div>

          <form onSubmit={applyPromo} className="mt-7">
            <label htmlFor="promo" className="label block text-ink">Promo code</label>
            <div className="mt-3 flex gap-2">
              <input
                id="promo"
                className="field min-w-0 flex-1 uppercase placeholder:normal-case"
                placeholder="Enter code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                autoComplete="off"
                maxLength={40}
                aria-describedby={quote?.promo ? 'promo-message' : undefined}
              />
              <button type="submit" className="btn btn-secondary shrink-0 px-5">Apply</button>
            </div>
            {quote?.promo && promo ? (
              <p id="promo-message" role="status" className={`mt-2 text-xs ${quote.promo.applied ? 'text-success' : 'text-danger'}`}>
                {quote.promo.message}{' '}
                <button type="button" onClick={clearPromo} className="underline underline-offset-2">Remove code</button>
              </p>
            ) : null}
          </form>

          {canCheckout ? (
            <Link href="/checkout" className="btn btn-primary mt-6 w-full">
              Checkout<span className="lg:hidden"> · {formatMoney(totals!.total)}</span>
            </Link>
          ) : (
            <button type="button" disabled className="btn btn-primary mt-6 w-full">
              {loading || !quote ? 'Checking your bag…' : 'Checkout'}
            </button>
          )}
          {bagProblems.length > 0 ? (
            <p className="mt-3 text-xs text-danger">Some pieces need your attention before you check out. See the notes above.</p>
          ) : null}

          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <Lock size={13} strokeWidth={1.5} aria-hidden />
            Secure checkout. One payment, every maker.
          </p>
          <p className="mt-5 border-t border-line-strong pt-5 text-xs leading-relaxed text-muted">
            Your bag holds pieces from {plural(makers, 'maker')}. Each ships directly to you, so parcels may arrive separately.
          </p>
        </aside>
      </div>
    </div>
  );
}

function BagRow({
  line,
  lineTotal,
  unitPrice,
  problem,
  onQuantity,
  onRemove,
  onMove,
}: {
  line: BagLine;
  lineTotal: number | null;
  unitPrice: number;
  problem: { problem: LineProblem; available: number } | null;
  onQuantity(q: number): void;
  onRemove(): void;
  onMove(): void;
}) {
  const shown = lineTotal ?? unitPrice * line.quantity;
  return (
    <li className="flex gap-4 border-b border-line py-8 sm:gap-6">
      <Link href={`/products/${line.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <ProductImage image={line.image} sizes="140px" showLabel={false} className={`aspect-[3/4] w-24 sm:w-[140px] ${problem ? 'opacity-50' : ''}`} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{line.vendorName}</p>
            <h2 className="mt-1.5 font-display text-[19px] leading-snug sm:text-[22px]">
              <Link href={`/products/${line.slug}`} className="hover:opacity-70">{line.title}</Link>
            </h2>
            <p className="mt-2 text-sm text-ink-2">{line.colour} · Size {line.size}</p>
            <p className="mt-1.5 text-xs text-muted">Sold and shipped by {line.vendorName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-medium">{formatMoney(shown)}</p>
            {line.quantity > 1 ? <p className="mt-1 text-xs text-muted">{formatMoney(unitPrice)} each</p> : null}
          </div>
        </div>

        {problem ? <ProblemNote problem={problem} quantity={line.quantity} onQuantity={onQuantity} onRemove={onRemove} /> : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {problem?.problem !== 'unavailable' ? (
            <QuantityStepper value={line.quantity} onChange={onQuantity} label={line.title} />
          ) : null}
          <button type="button" onClick={onMove} className="text-xs underline underline-offset-4 hover:text-muted">Move to wishlist</button>
          <button type="button" onClick={onRemove} className="text-xs underline underline-offset-4 hover:text-muted">Remove</button>
        </div>
      </div>
    </li>
  );
}

function ProblemNote({
  problem,
  quantity,
  onQuantity,
  onRemove,
}: {
  problem: { problem: LineProblem; available: number };
  quantity: number;
  onQuantity(q: number): void;
  onRemove(): void;
}) {
  let text: string;
  let action: { label: string; run(): void };
  if (problem.problem === 'unavailable') {
    text = 'This piece is no longer available.';
    action = { label: 'Remove it', run: onRemove };
  } else if (problem.available <= 0) {
    text = 'This size has just sold out.';
    action = { label: 'Remove it', run: onRemove };
  } else {
    text = `Only ${problem.available} left in this size, and you have ${quantity} in your bag.`;
    action = { label: `Change to ${problem.available}`, run: () => onQuantity(problem.available) };
  }
  return (
    <p role="alert" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#f7ebe8] px-3 py-2 text-xs text-danger">
      <span>{text}</span>
      <button type="button" onClick={action.run} className="font-medium underline underline-offset-2">{action.label}</button>
    </p>
  );
}

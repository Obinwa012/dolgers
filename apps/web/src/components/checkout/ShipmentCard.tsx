import type { ReactNode } from 'react';
import { formatMoney, type OrderLine, type Tracking, type VendorOrderStatus } from '@dolgers/shared';
import { ProductImage } from '@/components/ProductImage';
import { StatusDot, VENDOR_ORDER_STATUS, vendorOrderTone } from '@/components/account/status';
import { formatDateRange } from './format';
import { lineMeta } from './OrderSummary';

/** One maker's parcel: status, the pieces in it, and when it should arrive. */
export function ShipmentCard({
  vendorName,
  status,
  lines,
  estimatedDelivery,
  tracking,
  children,
}: {
  vendorName: string;
  status: VendorOrderStatus;
  lines: OrderLine[];
  estimatedDelivery: { from: number; to: number } | null;
  tracking?: Tracking | null;
  children?: ReactNode;
}) {
  return (
    <article className="border border-line-strong p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="label">{vendorName}</h3>
        <StatusDot label={VENDOR_ORDER_STATUS[status]} tone={vendorOrderTone(status)} />
      </header>
      <ul className="mt-5 space-y-4">
        {lines.map((l) => (
          <li key={l.sku} className="flex items-center gap-4 sm:gap-5">
            <ProductImage image={l.image} sizes="72px" showLabel={false} className="aspect-[3/4] w-[72px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug">{l.title}</p>
              <p className="mt-1 text-xs text-muted">{lineMeta(l)}</p>
            </div>
            <p className="text-sm font-medium">{formatMoney(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-1 text-xs text-ink-2">
        {tracking ? (
          <p>
            Shipped with {tracking.carrier}, tracking{' '}
            {tracking.url.startsWith('https://') ? (
              <a href={tracking.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {tracking.number}
              </a>
            ) : (
              <span>{tracking.number}</span>
            )}
          </p>
        ) : null}
        {estimatedDelivery && status !== 'cancelled' && status !== 'refunded' ? (
          <p>Estimated delivery: {formatDateRange(estimatedDelivery.from, estimatedDelivery.to)}</p>
        ) : status === 'preparing' || status === 'awaiting_payment' ? (
          <p>Estimated delivery: we will confirm when it ships.</p>
        ) : null}
      </div>
      {children}
    </article>
  );
}

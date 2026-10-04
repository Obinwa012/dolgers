import { formatMoney, type Address, type OrderLine } from '@dolgers/shared';
import { ProductImage } from '@/components/ProductImage';

/** Order lines with thumbnail, size, quantity and line total. */
export function OrderLines({ lines, showVendor = false }: { lines: OrderLine[]; showVendor?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.sku} className="flex gap-4 py-3 first:pt-0 last:pb-0">
          <ProductImage image={l.image} sizes="56px" className="aspect-[3/4] w-14 shrink-0" showLabel={false} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{l.title}</p>
            <p className="text-muted">
              {showVendor ? `${l.vendorName} · ` : ''}Size {l.size} · {l.colour}
            </p>
            <p className="font-mono text-xs text-faint">{l.sku}</p>
          </div>
          <div className="shrink-0 text-right text-sm tabular-nums">
            <p>{l.quantity} × {formatMoney(l.unitPrice)}</p>
            <p className="font-medium">{formatMoney(l.lineTotal)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AddressBlock({ address }: { address: Address }) {
  return (
    <address className="text-sm not-italic leading-relaxed">
      {address.firstName} {address.lastName}<br />
      {address.line1}<br />
      {address.line2 ? <>{address.line2}<br /></> : null}
      {address.city}, {address.state} {address.postalCode}<br />
      United States
      {address.phone ? <><br /><span className="text-muted">{address.phone}</span></> : null}
    </address>
  );
}

/** Label/amount rows with a bold total line. */
export function MoneySummary({ rows, total }: { rows: [string, string][]; total?: [string, string] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-muted">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
      {total ? (
        <div className="flex justify-between gap-4 border-t border-line pt-3 font-medium">
          <dt>{total[0]}</dt>
          <dd className="tabular-nums">{total[1]}</dd>
        </div>
      ) : null}
    </dl>
  );
}

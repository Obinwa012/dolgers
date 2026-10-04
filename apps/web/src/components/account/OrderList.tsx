import Link from 'next/link';
import { formatMoney, type Order } from '@dolgers/shared';
import { formatDate, plural } from '@/components/checkout/format';
import { ORDER_STATUS, StatusDot } from './status';

export function OrderList({ orders }: { orders: Order[] }) {
  return (
    <ul className="border-t border-line">
      {orders.map((o) => {
        const items = o.lines.reduce((s, l) => s + l.quantity, 0);
        return (
          <li key={o.id} className="border-b border-line">
            <Link href={`/account/orders/${o.id}`} className="group grid gap-2 py-5 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center sm:gap-6">
              <div>
                <p className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">{o.number}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(o.createdAt)}</p>
              </div>
              <p className="text-sm text-ink-2">
                {plural(items, 'item')} · {plural(o.vendorIds.length, 'maker')}
              </p>
              <StatusDot label={ORDER_STATUS[o.status]} tone={o.status === 'shipped' ? 'success' : o.status === 'cancelled' || o.status === 'refunded' ? 'muted' : 'ink'} />
              <p className="text-sm font-medium sm:text-right">{formatMoney(o.totals.total)}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

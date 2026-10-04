import type { OrderStatus, ReturnStatus, VendorOrderStatus } from '@dolgers/shared';

export const ORDER_STATUS: Record<OrderStatus, string> = {
  pending_payment: 'Confirming payment',
  paid: 'Preparing',
  partially_shipped: 'Partly shipped',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
};

export const VENDOR_ORDER_STATUS: Record<VendorOrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  preparing: 'Preparing to ship',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const RETURN_STATUS: Record<ReturnStatus, string> = {
  requested: 'Return requested',
  approved: 'Return approved',
  rejected: 'Return declined',
  refunded: 'Refunded',
};

/** Small uppercase status with a dot, as on the confirmation frame ("● PREPARING TO SHIP"). */
export function StatusDot({ label, tone = 'ink' }: { label: string; tone?: 'ink' | 'success' | 'muted' | 'danger' }) {
  const color = { ink: 'bg-ink', success: 'bg-success', muted: 'bg-faint', danger: 'bg-danger' }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

export function vendorOrderTone(s: VendorOrderStatus): 'ink' | 'success' | 'muted' | 'danger' {
  return s === 'shipped' ? 'success' : s === 'cancelled' || s === 'refunded' ? 'muted' : 'ink';
}

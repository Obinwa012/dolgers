import type { Metadata } from 'next';
import { OrdersView } from '@/components/account/OrdersView';

export const metadata: Metadata = { title: 'Orders' };

export default function AccountOrdersPage() {
  return <OrdersView />;
}

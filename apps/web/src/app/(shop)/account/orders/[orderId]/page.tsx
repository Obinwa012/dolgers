import type { Metadata } from 'next';
import { OrderDetailView } from '@/components/account/OrderDetailView';

export const metadata: Metadata = { title: 'Order' };

export default function AccountOrderPage() {
  return <OrderDetailView />;
}

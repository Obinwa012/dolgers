import type { Metadata } from 'next';
import { ConfirmationView } from '@/components/checkout/ConfirmationView';

export const metadata: Metadata = { title: 'Order confirmed' };

export default function OrderConfirmedPage() {
  return <ConfirmationView />;
}

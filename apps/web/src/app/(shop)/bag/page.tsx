import type { Metadata } from 'next';
import { BagView } from '@/components/checkout/BagView';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false, follow: true } };

export default function BagPage() {
  return <BagView />;
}

import type { Metadata } from 'next';
import { VendorApplyView } from '@/components/account/VendorApplyView';

export const metadata: Metadata = {
  title: 'Apply to sell',
  description: 'Apply to sell your label on DOLGERS, a marketplace of independent labels for men and boys.',
};

export default function SellApplyPage() {
  return <VendorApplyView />;
}

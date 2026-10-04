import type { Metadata } from 'next';
import { AddressesView } from '@/components/account/AddressesView';

export const metadata: Metadata = { title: 'Addresses' };

export default function AccountAddressesPage() {
  return <AddressesView />;
}

import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const metadata: Metadata = {
  title: { default: 'Vendor dashboard', template: '%s — Vendor — DOLGERS' },
  robots: { index: false, follow: false },
};

const NAV = [
  { label: 'Overview', href: '/vendor' },
  { label: 'Products', href: '/vendor/products' },
  { label: 'Inventory', href: '/vendor/inventory' },
  { label: 'Orders', href: '/vendor/orders' },
  { label: 'Returns', href: '/vendor/returns' },
  { label: 'Payouts', href: '/vendor/payouts' },
  { label: 'Storefront', href: '/vendor/storefront' },
];

export default function VendorLayout({ children }: LayoutProps<'/vendor'>) {
  return <DashboardShell area="vendor" nav={NAV}>{children}</DashboardShell>;
}

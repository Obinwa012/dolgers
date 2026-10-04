import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const metadata: Metadata = {
  title: { default: 'Admin console', template: '%s — Admin — DOLGERS' },
  robots: { index: false, follow: false },
};

const NAV = [
  { label: 'Overview', href: '/admin' },
  { label: 'Applications', href: '/admin/applications' },
  { label: 'Vendors', href: '/admin/vendors' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Promo codes', href: '/admin/promos' },
  { label: 'Home page', href: '/admin/home' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Team & search', href: '/admin/team' },
  { label: 'Audit log', href: '/admin/audit' },
];

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return <DashboardShell area="admin" nav={NAV}>{children}</DashboardShell>;
}

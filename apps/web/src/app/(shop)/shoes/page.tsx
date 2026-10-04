import type { Metadata } from 'next';
import { DepartmentListing } from '@/components/shop/DepartmentListing';

export const metadata: Metadata = {
  title: 'Shoes',
  description: 'Chelsea boots, loafers and weatherproof runners for men and boys, from makers who still resole what they sell.',
  alternates: { canonical: '/shoes' },
};

export default async function ShoesPage({ searchParams }: PageProps<'/shoes'>) {
  return (
    <DepartmentListing
      searchParams={await searchParams}
      pathname="/shoes"
      title="Shoes"
      description="Chelsea boots, suede loafers and weatherproof runners for men and boys, from makers who still resole what they sell."
      base={{ leaf: 'shoes' }}
    />
  );
}

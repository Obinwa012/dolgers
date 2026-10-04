import type { Metadata } from 'next';
import { DepartmentListing } from '@/components/shop/DepartmentListing';

export const metadata: Metadata = {
  title: 'Accessories',
  description: 'Scarves, caps and the small things that finish a look, from independent labels.',
  alternates: { canonical: '/accessories' },
};

export default async function AccessoriesPage({ searchParams }: PageProps<'/accessories'>) {
  return (
    <DepartmentListing
      searchParams={await searchParams}
      pathname="/accessories"
      title="Accessories"
      description="Scarves, caps and the small things that finish a look."
      base={{ leaf: 'accessories' }}
    />
  );
}

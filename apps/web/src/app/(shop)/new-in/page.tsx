import type { Metadata } from 'next';
import { NEW_WINDOW_DAYS } from '@dolgers/shared';
import { DepartmentListing } from '@/components/shop/DepartmentListing';

export const metadata: Metadata = {
  title: 'New arrivals',
  description: 'The latest pieces from independent labels for men and boys.',
  alternates: { canonical: '/new-in' },
};

export default async function NewInPage({ searchParams }: PageProps<'/new-in'>) {
  return (
    <DepartmentListing
      searchParams={await searchParams}
      pathname="/new-in"
      title="New Arrivals"
      description={`Everything our makers have added in the last ${NEW_WINDOW_DAYS} days. Fresh from the workroom.`}
      base={{ newOnly: true }}
      emptyMessage="Nothing new here yet. Check back soon."
    />
  );
}

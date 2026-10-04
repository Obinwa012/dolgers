import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Journal', description: 'Maker stories, workshop visits and notes on caring for good clothes. Coming soon.', alternates: { canonical: '/journal' } };

export default function JournalPage() {
  return (
    <ContentPage
      eyebrow="Journal"
      title="Coming soon"
      intro="Maker stories, workshop visits and notes on caring for good clothes. The first pieces are being written now."
    >
      <div className="flex flex-wrap gap-3">
        <Link href="/brands" className="btn btn-primary">Meet the makers</Link>
        <Link href="/#join-the-list" className="btn btn-secondary">Join the list</Link>
      </div>
    </ContentPage>
  );
}

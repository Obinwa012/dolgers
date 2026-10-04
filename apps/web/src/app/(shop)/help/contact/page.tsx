import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Contact us', description: 'Get in touch with the DOLGERS team.', alternates: { canonical: '/help/contact' } };

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Contact us"
      intro={
        <>
          Write to us at{' '}
          <a href="mailto:support@dolgers.com" className="text-ink underline underline-offset-4">support@dolgers.com</a>. A real person replies, usually
          within one working day.
        </>
      }
      note="Samuel to confirm support hours and the reply-time promise before launch."
    >
      <Section title="About an order">
        <p>Include your order number (it starts with DLG- and is in your confirmation email) so we can find it quickly. Most answers are also in your <Link href="/account">account</Link>, where you can track parcels and request returns.</p>
      </Section>
      <Section title="Quick answers">
        <ul>
          <li><Link href="/help/delivery">Delivery times and prices</Link></li>
          <li><Link href="/help/returns">Returns and refunds</Link></li>
          <li><Link href="/help/size-guide">Size guide</Link></li>
        </ul>
      </Section>
      <Section title="Makers and press">
        <p>Run a label and want to sell on DOLGERS? Start at <Link href="/sell">Sell with us</Link>. For press and partnerships, email support@dolgers.com with &ldquo;Press&rdquo; in the subject line.</p>
      </Section>
    </ContentPage>
  );
}

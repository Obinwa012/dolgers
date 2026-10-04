import type { Metadata } from 'next';
import Link from 'next/link';
import { RETURN_WINDOW_DAYS } from '@dolgers/shared';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Terms of service', description: 'The terms for shopping on DOLGERS.', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of service"
      intro="These terms apply when you browse or buy on DOLGERS. By placing an order you agree to them. Last updated October 2026."
      note="This is a plain-English draft, not legal advice. Samuel must have it reviewed by a lawyer and fill in the company's legal name, address and governing-law state before launch. Seller terms for makers are separate."
    >
      <Section title="Who you're buying from">
        <p>DOLGERS is a marketplace. Each product is sold and shipped by the independent maker named on its page. DOLGERS runs the store, takes payment on the maker&rsquo;s behalf and handles customer service, returns and refunds.</p>
      </Section>
      <Section title="Orders and prices">
        <p>Prices are in US dollars. Sales tax is added at checkout where it applies. Your order is accepted when payment is confirmed and we send you a confirmation email. If a piece turns out to be unavailable, or a price was shown in error, we&rsquo;ll tell you and refund you in full.</p>
      </Section>
      <Section title="Delivery">
        <p>We deliver to addresses in the United States only. Delivery estimates are given in good faith; see <Link href="/help/delivery">Delivery</Link> for details.</p>
      </Section>
      <Section title="Returns">
        <p>You can return unworn items within {RETURN_WINDOW_DAYS} days of delivery, as described in our <Link href="/help/returns">returns policy</Link>. This doesn&rsquo;t affect your rights under applicable law if something is faulty.</p>
      </Section>
      <Section title="Your account">
        <p>Keep your sign-in details private. You&rsquo;re responsible for activity on your account. We may suspend accounts used for fraud or abuse.</p>
      </Section>
      <Section title="Content">
        <p>Product photos, descriptions and maker stories belong to DOLGERS or the makers who supplied them. Please don&rsquo;t copy them without permission.</p>
      </Section>
      <Section title="Liability">
        <p>To the extent the law allows, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits liability that can&rsquo;t be limited by law.</p>
      </Section>
      <Section title="Contact">
        <p>Questions about these terms? Email <a href="mailto:support@dolgers.com">support@dolgers.com</a>.</p>
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from 'next';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Privacy policy', description: 'How DOLGERS collects, uses and protects your personal information.', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="This policy explains what personal information DOLGERS collects, why, and the choices you have. Last updated October 2026."
      note="This is a plain-English draft, not legal advice. Samuel must have it reviewed by a lawyer, add the company's legal name and mailing address, and confirm state-law requirements (for example California CCPA/CPRA) before launch."
    >
      <Section title="What we collect">
        <ul>
          <li><strong>Account and order details:</strong> your name, email, delivery and billing addresses, phone number and order history.</li>
          <li><strong>Payment details:</strong> card and wallet payments are handled by Stripe. We never see or store your full card number.</li>
          <li><strong>Your preferences:</strong> wishlist, followed makers and newsletter choice.</li>
          <li><strong>Technical data:</strong> basic device and browser information, and security signals used to prevent fraud and abuse.</li>
        </ul>
      </Section>
      <Section title="How we use it">
        <ul>
          <li>To take payment, pass your order to the makers who fulfil it, and handle delivery, returns and refunds.</li>
          <li>To run your account and answer your questions.</li>
          <li>To send newsletters, only if you&rsquo;ve asked to receive them. Every email has an unsubscribe link.</li>
          <li>To keep the store secure and meet our legal and tax obligations.</li>
        </ul>
      </Section>
      <Section title="Who we share it with">
        <p>Makers receive the name, address and items they need to ship your order. We also use service providers to run the store: Google Firebase (hosting, accounts and database), Stripe (payments and tax calculation), our search provider and our email provider. They may only use your information to provide their service to us. We do not sell your personal information.</p>
      </Section>
      <Section title="Cookies and local storage">
        <p>We use your browser&rsquo;s storage to remember your bag and wishlist, and essential cookies to keep you signed in and protect against bots. We don&rsquo;t use advertising cookies.</p>
      </Section>
      <Section title="Your rights">
        <p>You can see and update your details in your account at any time. You can ask us for a copy of your information, or ask us to delete it, by emailing <a href="mailto:support@dolgers.com?subject=Privacy">support@dolgers.com</a>. We keep order records for as long as tax and accounting law requires.</p>
      </Section>
      <Section title="Children">
        <p>DOLGERS sells clothes for boys, but accounts are for adults. We don&rsquo;t knowingly collect information from children under 13.</p>
      </Section>
    </ContentPage>
  );
}

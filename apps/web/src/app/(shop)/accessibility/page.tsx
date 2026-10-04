import type { Metadata } from 'next';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Accessibility', description: 'Our commitment to an accessible store.', alternates: { canonical: '/accessibility' } };

export default function AccessibilityPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Accessibility"
      intro="We want everyone to be able to browse and buy on DOLGERS, whatever device or assistive technology they use."
      note="Samuel to confirm whether an external accessibility audit will be commissioned before launch."
    >
      <Section title="Our standard">
        <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. The store is built with semantic HTML, keyboard navigation, visible focus states, text alternatives for images and labels on every form field, and it works at screen widths down to 320 pixels and with text zoomed to 200%.</p>
      </Section>
      <Section title="Known limitations">
        <p>Product photos are supplied by our makers, and some image descriptions may be brief. We review them as part of listing approval and keep improving them.</p>
      </Section>
      <Section title="Tell us about a problem">
        <p>If anything on the site is hard to use, email <a href="mailto:support@dolgers.com?subject=Accessibility">support@dolgers.com</a> with &ldquo;Accessibility&rdquo; in the subject line. Tell us the page and what happened, and we&rsquo;ll fix it or help you complete your order another way.</p>
      </Section>
    </ContentPage>
  );
}

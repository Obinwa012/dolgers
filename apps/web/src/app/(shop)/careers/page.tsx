import type { Metadata } from 'next';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Careers', description: 'Work with DOLGERS.', alternates: { canonical: '/careers' } };

export default function CareersPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Careers"
      intro="We're a small team building a better home for independent labels. There are no open roles right now, but we're always glad to hear from good people."
      note="Samuel to update this page when roles open."
    >
      <Section title="Get in touch">
        <p>
          If you work in menswear, kidswear, operations or engineering and want to help small makers reach more people, email{' '}
          <a href="mailto:support@dolgers.com?subject=Careers">support@dolgers.com</a> with &ldquo;Careers&rdquo; in the subject line. Tell us what you&rsquo;d
          like to work on and include a link to your work.
        </p>
      </Section>
    </ContentPage>
  );
}

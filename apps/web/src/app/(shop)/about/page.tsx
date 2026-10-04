import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'About DOLGERS', description: 'A marketplace of independent labels for men and boys.', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="About DOLGERS"
      intro="DOLGERS is a marketplace of independent labels for men and boys: overcoats, knitwear, denim and boots from makers who build clothes to last."
    >
      <Section title="Why we started">
        <p>The best-made clothes often come from small workshops that most people never hear about. They don&rsquo;t have the budget for big campaigns, and shoppers don&rsquo;t have the time to find them one by one. DOLGERS puts them in one place, with one bag, one checkout and one set of returns.</p>
      </Section>
      <Section title="How it works">
        <p>Every label on DOLGERS is independent. They design their own pieces, make them in small runs and ship them to you directly from their own workrooms. We choose who sells here, look after the checkout and payments, and stand behind every order.</p>
      </Section>
      <Section title="What we look for">
        <ul>
          <li>Pieces made to be worn for years, not a season.</li>
          <li>Honest materials, clearly described.</li>
          <li>Makers who repair, resole or stand behind what they sell.</li>
        </ul>
      </Section>
      <Section title="For men and boys">
        <p>We cover both, because good clothes shouldn&rsquo;t stop at adult sizes. Boys&rsquo; pieces are cut for growing, washing and the playground, and built as carefully as the grown-up versions.</p>
        <p><Link href="/brands">Meet our makers</Link> or <Link href="/new-in">see what&rsquo;s new</Link>.</p>
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_COMMISSION_BPS } from '@dolgers/shared';

export const metadata: Metadata = {
  title: 'Sell with us',
  description: 'Sell your label on DOLGERS: a curated US marketplace for independent menswear and boyswear makers.',
  alternates: { canonical: '/sell' },
};

const commission = `${DEFAULT_COMMISSION_BPS / 100}%`;

const WHY = [
  ['Customers who care how things are made', 'Our shoppers come looking for independent labels and are happy to pay for quality. Your story sits next to your product, not buried behind it.'],
  ['One checkout, many makers', 'Shoppers can buy from several labels in one order. We handle payments, sales tax calculation, fraud screening and customer service.'],
  ['You stay in control', 'Set your own prices, manage your own stock and ship from your own workroom. No exclusivity and no minimum volumes.'],
  ['Paid automatically', `Payouts go straight to your bank through Stripe. You only pay a ${commission} commission on what you sell; no listing or monthly fees.`],
] as const;

const STEPS = [
  ['Apply', 'Tell us about your label, what you make and where you ship from. It takes about ten minutes.'],
  ['Get approved', 'We review every application by hand and usually reply within a week.'],
  ['Set up payouts with Stripe', 'Connect a Stripe account from your vendor dashboard so we can pay you. Stripe verifies your identity and bank details securely.'],
  ['List your products', 'Add photos, descriptions, sizes, prices and stock. We check each listing before it goes live.'],
  ['Ship directly', 'When an order comes in, you pack and ship it, add tracking, and we keep the customer updated.'],
] as const;

export default function SellPage() {
  return (
    <div>
      <section className="bg-ink text-white">
        <div className="container-page pb-16 pt-8 md:pb-24">
          <nav aria-label="Breadcrumb" className="text-xs text-white/60">
            <ol className="flex gap-2">
              <li><Link href="/" className="hover:text-white">Home</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-white">Sell with us</li>
            </ol>
          </nav>
          <p className="label mt-16 text-white/70 md:mt-24">For independent labels</p>
          <h1 className="display mt-5 max-w-3xl text-[52px] md:text-[88px]">Sell with DOLGERS</h1>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/75">
            A curated marketplace for independent labels making clothes and shoes for men and boys, selling to customers across the United States.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/sell/apply" className="btn btn-light">Apply to sell</Link>
            <a href="#how-it-works" className="btn btn-outline-light">How it works</a>
          </div>
        </div>
      </section>

      <section className="container-page mt-20 md:mt-28" aria-labelledby="why">
        <p className="label text-muted">Why DOLGERS</p>
        <h2 id="why" className="display mt-4 text-[36px] md:text-[48px]">Built for small makers</h2>
        <ul className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([title, body]) => (
            <li key={title} className="border-t border-ink pt-5">
              <h3 className="text-[16px] font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" className="container-page mt-20 scroll-mt-28 md:mt-28" aria-labelledby="how">
        <p className="label text-muted">How it works</p>
        <h2 id="how" className="display mt-4 text-[36px] md:text-[48px]">From application to first order</h2>
        <ol className="mt-10 border-t border-line">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid gap-2 border-b border-line py-6 md:grid-cols-[80px_260px_1fr] md:gap-8">
              <span className="display text-[28px] text-faint">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="text-[16px] font-medium md:pt-2">{title}</h3>
              <p className="text-sm leading-relaxed text-muted md:pt-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page mt-20 md:mt-28" aria-labelledby="fees">
        <div className="grid gap-10 bg-stone p-8 md:grid-cols-2 md:items-center md:p-14">
          <div>
            <p className="label text-muted">Fees</p>
            <h2 id="fees" className="display mt-4 text-[36px] md:text-[48px]">{commission} commission. That&rsquo;s it.</h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-ink-2">
            <p>Our standard commission is {commission} of the item price on each sale, taken before your payout. There are no listing fees, monthly fees or setup costs.</p>
            <p>Standard delivery is free for customers; you ship with the carrier of your choice. Returns are accepted within 30 days of delivery and refunded from the sale.</p>
          </div>
        </div>
      </section>

      <section className="container-page mt-20 text-center md:mt-28">
        <h2 className="display text-[36px] md:text-[48px]">Ready to apply?</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">You&rsquo;ll need a DOLGERS account. We&rsquo;ll review your application and reply by email.</p>
        <Link href="/sell/apply" className="btn btn-primary mt-8">Apply to sell</Link>
        <p className="mx-auto mt-14 max-w-xl text-xs leading-relaxed text-faint">
          Samuel to confirm: who pays for shipping labels and return postage, the payout timing after delivery, and the final seller terms. The {commission} rate is the default; individual rates can differ by agreement.
        </p>
      </section>
    </div>
  );
}

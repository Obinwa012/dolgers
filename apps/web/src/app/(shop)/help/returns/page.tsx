import type { Metadata } from 'next';
import Link from 'next/link';
import { RETURN_WINDOW_DAYS } from '@dolgers/shared';
import { ContentPage, Section } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Returns', description: `Free returns within ${RETURN_WINDOW_DAYS} days on every DOLGERS order.`, alternates: { canonical: '/help/returns' } };

export default function ReturnsPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Returns"
      crumbs={[{ label: 'Help', href: '/help/contact' }]}
      intro={`Changed your mind? Return anything unworn within ${RETURN_WINDOW_DAYS} days of delivery, free of charge.`}
      note="Samuel to confirm the return-shipping arrangement (prepaid labels per maker) and any final-sale categories before launch."
    >
      <Section title="How to return">
        <ul>
          <li>Go to <Link href="/account">your account</Link>, open the order and choose <em>Request a return</em> for the pieces you&rsquo;re sending back.</li>
          <li>The maker reviews the request, usually within two working days, and sends you return instructions and a prepaid label.</li>
          <li>Pack the items in their original packaging with tags attached and drop the parcel off with the carrier.</li>
        </ul>
        <p>Checked out as a guest? Create an account with the same email address to see your orders, or <Link href="/help/contact">contact us</Link> with your order number.</p>
      </Section>
      <Section title="Condition">
        <p>Items must be unworn, unwashed and unaltered, with the original tags attached. Shoes should be tried on indoors only, and returned in their box.</p>
      </Section>
      <Section title="Refunds">
        <p>Once the maker receives and checks your return, we refund the item price to your original payment method. Refunds usually appear within 5–10 working days, depending on your bank. If you paid for express delivery, that charge isn&rsquo;t refunded unless the item was faulty.</p>
      </Section>
      <Section title="Exchanges">
        <p>The quickest way to get a different size is to return the original and place a new order, so the size you want isn&rsquo;t sold out while the return travels.</p>
      </Section>
      <Section title="Faulty or wrong items">
        <p>If something arrives damaged or isn&rsquo;t what you ordered, <Link href="/help/contact">let us know</Link> within {RETURN_WINDOW_DAYS} days with a photo. We&rsquo;ll arrange a replacement or a full refund, including delivery.</p>
      </Section>
    </ContentPage>
  );
}

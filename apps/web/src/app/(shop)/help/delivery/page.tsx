import type { Metadata } from 'next';
import Link from 'next/link';
import { DELIVERY, formatMoney } from '@dolgers/shared';
import { ContentPage, Section, Table } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Delivery', description: 'How and when DOLGERS orders arrive: free standard delivery across the United States.', alternates: { canonical: '/help/delivery' } };

export default function DeliveryPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Delivery"
      crumbs={[{ label: 'Help', href: '/help/contact' }]}
      intro="Every piece ships directly from the maker who made it. Standard delivery is free on every order, anywhere in the United States."
      note="Delivery times and the express price shown here come from the store settings. Samuel to confirm the carrier list and the Alaska and Hawaii timings before launch."
    >
      <Section title="Options and prices">
        <Table
          caption="Delivery options"
          head={['Option', 'Price', 'Time']}
          rows={[
            [DELIVERY.standard.label, DELIVERY.standard.price === 0 ? 'Free' : formatMoney(DELIVERY.standard.price), DELIVERY.standard.detail],
            [DELIVERY.express.label, formatMoney(DELIVERY.express.price), DELIVERY.express.detail],
          ]}
        />
        <p>Times are counted in working days (Monday to Friday, excluding US federal holidays) from when the maker dispatches your order. Each product page shows how quickly that maker usually dispatches.</p>
      </Section>
      <Section title="Where we deliver">
        <p>We deliver to addresses in all 50 states and Washington, D.C. Orders to Alaska and Hawaii can take a few extra days. We don&rsquo;t ship outside the United States yet.</p>
      </Section>
      <Section title="Orders from more than one maker">
        <p>If your bag has pieces from several makers, each one ships its part separately, so you may receive more than one parcel. You only pay for delivery once.</p>
      </Section>
      <Section title="Tracking">
        <p>We email you a tracking link as soon as each maker ships. You can also follow every parcel from <Link href="/account">your account</Link>.</p>
      </Section>
      <Section title="Sales tax">
        <p>Sales tax is calculated at checkout based on your delivery address and is shown before you pay.</p>
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from 'next';
import { ContentPage, Section, Table } from '@/components/shop/ContentPage';

export const metadata: Metadata = { title: 'Size guide', description: 'Clothing, shoe, waist and kids sizes on DOLGERS, with US conversions.', alternates: { canonical: '/help/size-guide' } };

export default function SizeGuidePage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Size guide"
      crumbs={[{ label: 'Help', href: '/help/contact' }]}
      intro="Our makers cut their own patterns, so always read the fit note on the product page. These charts are a starting point. Measurements are body measurements, in inches."
      note="These are standard industry measurements. Makers may cut differently; Samuel to confirm whether any maker needs its own chart."
    >
      <Section title="Clothing (XS–XXL)" id="alpha">
        <Table
          caption="Men's clothing sizes"
          head={['Size', 'Chest', 'Waist', 'Neck']}
          rows={[
            ['XS', '33–35', '27–29', '14'],
            ['S', '35–37', '29–31', '14.5'],
            ['M', '38–40', '32–34', '15–15.5'],
            ['L', '41–43', '35–37', '16–16.5'],
            ['XL', '44–46', '38–40', '17–17.5'],
            ['XXL', '47–49', '41–43', '18–18.5'],
          ]}
        />
        <p>Measure your chest around the fullest part, under your arms, with the tape level.</p>
      </Section>
      <Section title="Shoes (EU sizes)" id="eu-shoe">
        <Table
          caption="Shoe size conversion"
          head={['EU', 'US men', 'UK', 'Foot length (in)']}
          rows={[
            ['38', '5.5', '5', '9.4'],
            ['39', '6.5', '6', '9.7'],
            ['40', '7', '6.5', '9.9'],
            ['41', '8', '7.5', '10.2'],
            ['42', '8.5', '8', '10.4'],
            ['43', '9.5', '9', '10.7'],
            ['44', '10.5', '10', '11.0'],
            ['45', '11.5', '11', '11.3'],
            ['46', '12', '11.5', '11.6'],
            ['47', '13', '12.5', '11.9'],
          ]}
        />
        <p>Stand on a sheet of paper, mark your heel and longest toe, and measure the distance. If you&rsquo;re between sizes, follow the fit note on the product page.</p>
      </Section>
      <Section title="Kids (by age)" id="age">
        <Table
          caption="Boys' sizes by age"
          head={['Age', 'Height', 'Chest', 'Waist']}
          rows={[
            ['2–3Y', '35–38', '21–22', '20–21'],
            ['4–5Y', '40–44', '22.5–23.5', '21–21.5'],
            ['6–7Y', '45–48', '24–25', '21.5–22'],
            ['8–9Y', '50–53', '26–27', '22.5–23.5'],
            ['10–11Y', '54–57', '28–29.5', '24–25'],
            ['12–13Y', '58–61', '30–31.5', '25.5–26.5'],
            ['14–15Y', '62–65', '32–33.5', '27–28'],
          ]}
        />
        <p>Height is the most reliable guide for children. If they&rsquo;re between sizes, size up: most of our boys&rsquo; pieces are cut with room to grow.</p>
      </Section>
      <Section title="Trousers and jeans (waist)" id="waist">
        <Table
          caption="Waist sizes"
          head={['Waist size', 'Waist (in)', 'Closest alpha size']}
          rows={[
            ['28', '28', 'XS'],
            ['29', '29', 'XS–S'],
            ['30', '30', 'S'],
            ['31', '31', 'S'],
            ['32', '32', 'M'],
            ['33', '33', 'M'],
            ['34', '34', 'M–L'],
            ['36', '36', 'L'],
            ['38', '38', 'XL'],
            ['40', '40', 'XL–XXL'],
          ]}
        />
        <p>Measure around your natural waist, where you&rsquo;d wear your trousers. Inseam lengths are listed in each product&rsquo;s fit note.</p>
      </Section>
    </ContentPage>
  );
}

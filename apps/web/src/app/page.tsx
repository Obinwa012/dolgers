import Link from 'next/link';
import { CareTag } from '@/components/CareTag';
import { ProductCard } from '@/components/ProductCard';
import { liveProducts } from '@/lib/catalog';

export const revalidate = 300;

const PROMISES = [
  { term: 'Ships from', detail: 'A US warehouse. No customs fees, no month-long waits.' },
  { term: 'Checked', detail: 'We read every review from people who bought it. Products with problems we can’t fix aren’t listed.' },
  { term: 'Fit', detail: 'Size guides in US sizes, with notes from US buyers on how it really fits.' },
  { term: 'Arrives', detail: 'The delivery window we’re quoted, not a hopeful one.' },
];

export default async function Home() {
  const products = await liveProducts();
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.25fr_1fr] md:pt-20">
        <div>
          <h1 className="display text-[clamp(3rem,7.4vw,6.25rem)] text-denim-deep">
            <span className="block">Already in the&nbsp;US.</span>
            <span className="block">Already checked.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Everyday clothes for men and women, stocked in US warehouses and vetted against real buyer reviews before they
            reach this page. You get honest sizing, honest delivery times, and anything worth knowing before you buy.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/men" className="rounded-md bg-denim px-5 py-3 font-semibold text-paper hover:bg-denim-deep">
              Shop men
            </Link>
            <Link href="/women" className="rounded-md border border-denim px-5 py-3 font-semibold text-denim hover:bg-mist">
              Shop women
            </Link>
          </div>
        </div>
        <CareTag title="What every item comes with" lines={PROMISES} />
      </section>

      <section aria-labelledby="new" className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="new" className="display border-t-2 border-ink pt-6 text-5xl">Just listed</h2>
        {products.length ? (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="mt-6 max-w-xl text-ink-soft">
            <p>
              Our first products are still going through vetting. Each one has to pass a check of its seller, its US
              shipping and every buyer review before it’s listed, so the shelves fill slowly on purpose.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

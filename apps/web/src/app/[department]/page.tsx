import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { DEPARTMENTS, type Department, liveProducts } from '@/lib/catalog';

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(DEPARTMENTS).map((department) => ({ department }));
}

export async function generateMetadata({ params }: { params: Promise<{ department: string }> }): Promise<Metadata> {
  const { department } = await params;
  const name = DEPARTMENTS[department as Department];
  return name ? { title: `${name} clothing`, description: `${name} clothing that ships from US warehouses, checked against real buyer reviews.` } : {};
}

export default async function DepartmentPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  const name = DEPARTMENTS[department as Department];
  if (!name) notFound();
  const products = (await liveProducts()).filter((p) => p.department === department);
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="display text-6xl text-denim-deep">{name}</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        {products.length
          ? `${products.length} item${products.length === 1 ? '' : 's'}, all shipping from US warehouses.`
          : `No ${name.toLowerCase()} items have passed vetting yet. New products are listed as soon as they do.`}
      </p>
      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

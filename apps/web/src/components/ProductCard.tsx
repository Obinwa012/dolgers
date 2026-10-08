import Link from 'next/link';
import { arrivalLabel, type Product, priceLabel } from '@/lib/catalog';

export function ProductCard({ product }: { product: Product }) {
  const img = product.images[0];
  const arrival = arrivalLabel(product.delivery);
  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="aspect-[4/5] overflow-hidden rounded-md bg-mist">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={img.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        )}
      </div>
      <h3 className="mt-3 text-[0.98rem] font-medium leading-snug group-hover:text-denim">{product.title}</h3>
      <p className="mt-1 font-semibold">{priceLabel(product)}</p>
      {arrival && <p className="mt-0.5 text-sm text-ink-soft">{arrival}</p>}
    </Link>
  );
}

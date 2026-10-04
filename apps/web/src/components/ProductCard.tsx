import Link from 'next/link';
import { formatMoney, type ProductImage as Img } from '@dolgers/shared';
import { ProductImage, isDarkTone } from './ProductImage';
import { WishlistButton } from './WishlistButton';

export interface CardProduct {
  id: string;
  slug: string;
  title: string;
  vendorName: string;
  price: number;
  priceMax?: number;
  image: Img | null;
  isNew?: boolean;
  /** Shown instead of the vendor name, e.g. on a brand page ("MEN"). */
  eyebrow?: string;
}

/** Product tile from the mockup: image (with NEW badge and wishlist heart), maker, title, price. */
export function ProductCard({ product, sizes = '(min-width: 1024px) 25vw, 50vw', priority }: { product: CardProduct; sizes?: string; priority?: boolean }) {
  const dark = isDarkTone(product.image?.tone);
  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <ProductImage image={product.image} sizes={sizes} priority={priority} className="aspect-[3/4] w-full" />
        <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{product.eyebrow ?? product.vendorName}</p>
        <h3 className="mt-1 text-[15px] leading-snug">{product.title}</h3>
        <p className="mt-1 text-[15px] font-medium">
          {formatMoney(product.price)}
          {product.priceMax && product.priceMax > product.price ? ` – ${formatMoney(product.priceMax)}` : ''}
        </p>
      </Link>
      {product.isNew ? (
        <span className="pointer-events-none absolute left-3 top-3 bg-paper px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]">New</span>
      ) : null}
      <WishlistButton productId={product.id} className={`absolute right-2 top-2 ${dark ? 'text-white' : 'text-ink'}`} />
    </article>
  );
}

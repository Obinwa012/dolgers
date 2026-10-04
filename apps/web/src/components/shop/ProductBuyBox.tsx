'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SIZE_SYSTEM_LABEL, formatMoney, type Product } from '@dolgers/shared';
import { useBag } from '@/context/BagProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { SizeGuideModal } from './SizeGuideModal';

export type BuyBoxProduct = Pick<Product, 'id' | 'slug' | 'title' | 'vendorId' | 'vendorName' | 'colour' | 'sizeSystem' | 'variants' | 'fitNote' | 'priceMin'> & {
  image: Product['images'][number] | null;
};

const sizeName = (system: Product['sizeSystem'], size: string) => (system === 'eu-shoe' ? `EU ${size}` : size);

/** Colour, size picker with live stock, Add to bag and Save to wishlist. */
export function ProductBuyBox({ product }: { product: BuyBoxProduct }) {
  const { add } = useBag();
  const { has, toggle } = useWishlist();
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const single = product.variants.length === 1 ? product.variants[0].size : null;
  const [size, setSize] = useState<string | null>(single);
  const [stock, setStock] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const saved = has(product.id);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability/${encodeURIComponent(product.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { sizes?: Record<string, boolean> } | null) => {
        if (!cancelled && body?.sizes) setStock(body.sizes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product.slug]);

  const soldOut = (s: string) => stock !== null && stock[s] === false;
  const soldOutSizes = product.variants.map((v) => v.size).filter(soldOut);
  const allSoldOut = stock !== null && soldOutSizes.length === product.variants.length;
  const variant = product.variants.find((v) => v.size === size) ?? null;
  const price = variant?.price ?? product.priceMin;

  const soldOutNote = soldOutSizes.length
    ? `${soldOutSizes.map((s) => sizeName(product.sizeSystem, s)).join(', ')} ${soldOutSizes.length === 1 ? 'is' : 'are'} sold out.`
    : '';

  const onAdd = () => {
    setAdded(null);
    if (!variant) {
      setError('Choose a size first.');
      return;
    }
    if (soldOut(variant.size)) {
      setError(`${sizeName(product.sizeSystem, variant.size)} is sold out. Choose another size.`);
      return;
    }
    setError('');
    add({
      sku: variant.sku,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      size: variant.size,
      colour: product.colour.name,
      price: variant.price,
      image: product.image,
    });
    setAdded(`${product.title}, ${sizeName(product.sizeSystem, variant.size)}`);
  };

  return (
    <div>
      <div className="border-t border-line pt-6">
        <p className="flex items-baseline gap-3">
          <span className="label">Colour</span>
          <span className="text-[13px] text-muted">{product.colour.name}</span>
        </p>
        <span
          aria-hidden
          className="mt-3 inline-block h-7 w-7 rounded-full border border-black/10 outline outline-1 outline-offset-2 outline-ink"
          style={{ background: product.colour.hex }}
        />
      </div>

      {product.sizeSystem !== 'one-size' ? (
        <fieldset className="mt-7">
          <div className="mb-3 flex items-baseline justify-between">
            <legend className="label float-left">{SIZE_SYSTEM_LABEL[product.sizeSystem]}</legend>
            <button
              type="button"
              onClick={() => setShowSizeGuide(true)}
              className="text-xs underline underline-offset-4 hover:text-muted"
            >
              Size guide
            </button>
          </div>
          <div className="clear-both grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5" role="radiogroup" aria-label={SIZE_SYSTEM_LABEL[product.sizeSystem]}>
            {product.variants.map((v) => {
              const out = soldOut(v.size);
              const on = size === v.size;
              return (
                <button
                  key={v.sku}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-disabled={out}
                  aria-label={out ? `${sizeName(product.sizeSystem, v.size)}, sold out` : sizeName(product.sizeSystem, v.size)}
                  onClick={() => {
                    if (out) return;
                    setSize(v.size);
                    setError('');
                  }}
                  className={`h-12 border px-1 text-[13px] transition-colors ${
                    out
                      ? 'cursor-not-allowed border-line bg-stone text-faint line-through'
                      : on
                        ? 'border-ink bg-ink text-white'
                        : 'border-line-strong hover:border-ink'
                  }`}
                >
                  {v.size}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="mt-7 text-[13px] text-muted">One size.</p>
      )}

      {soldOutNote || product.fitNote ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">{[soldOutNote, product.fitNote].filter(Boolean).join(' ')}</p>
      ) : null}

      <div className="mt-6 flex gap-2 md:flex-col">
        <button type="button" onClick={onAdd} disabled={allSoldOut} className="btn btn-primary flex-1 md:w-full">
          {allSoldOut ? 'Sold out' : <>Add to bag<span className="md:hidden"> · {formatMoney(price)}</span></>}
        </button>
        <button
          type="button"
          onClick={() => void toggle(product.id)}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          className="btn btn-secondary w-12 shrink-0 px-0 md:w-full md:px-7"
        >
          <Heart size={14} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden />
          <span className="hidden md:inline">{saved ? 'Saved to wishlist' : 'Save to wishlist'}</span>
        </button>
      </div>

      <div aria-live="polite" className="mt-3">
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        {added ? (
          <div className="flex items-center justify-between gap-4 bg-stone px-4 py-3 text-[13px]">
            <p>
              <span className="font-medium">Added to your bag.</span> <span className="text-muted">{added}</span>
            </p>
            <Link href="/bag" className="link-underline shrink-0">View bag</Link>
          </div>
        ) : null}
      </div>

      {showSizeGuide && (
        <SizeGuideModal
          sizeSystem={product.sizeSystem}
          fitNote={product.fitNote}
          onClose={() => setShowSizeGuide(false)}
        />
      )}
    </div>
  );
}

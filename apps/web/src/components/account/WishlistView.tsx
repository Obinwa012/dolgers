'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProductCard, type CardProduct } from '@/components/ProductCard';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { useWishlist } from '@/context/WishlistProvider';

export function WishlistView() {
  const { ids } = useWishlist();
  const { enabled, isMember } = useAuth();
  const [cache, setCache] = useState<Map<string, CardProduct | null>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => [...ids], [ids]);
  const missing = useMemo(() => list.filter((id) => !cache.has(id)), [list, cache]);
  const missingKey = missing.join(',');

  useEffect(() => {
    if (!missingKey) return;
    const ctrl = new AbortController();
    const batch = missingKey.split(',').slice(0, 30);
    fetch(`/api/products?ids=${encodeURIComponent(batch.join(','))}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json() as Promise<{ products: CardProduct[] }>;
      })
      .then(({ products }) => {
        setCache((prev) => {
          const next = new Map(prev);
          // Ids that come back empty are no longer on sale; remember that so we do not ask again.
          for (const id of batch) next.set(id, products.find((p) => p.id === id) ?? null);
          return next;
        });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError('We could not load your saved pieces. Please refresh the page.');
      });
    return () => ctrl.abort();
  }, [missingKey]);

  const products = list.map((id) => cache.get(id)).filter((p): p is CardProduct => !!p);
  const gone = list.filter((id) => cache.get(id) === null).length;
  const loading = missing.length > 0 && !error;

  return (
    <div className="container-page py-10 md:py-16">
      <div className="flex items-end justify-between gap-6 border-b border-ink pb-6">
        <h1 className="display text-[40px] md:text-[56px]">Wishlist</h1>
        <p className="text-sm text-muted">{products.length} saved</p>
      </div>

      {enabled && !isMember && list.length > 0 ? (
        <div className="mt-6">
          <Notice>
            Your wishlist is saved in this browser.{' '}
            <Link href="/sign-in?next=/wishlist" className="underline underline-offset-2">Sign in</Link> to keep it on every device.
          </Notice>
        </div>
      ) : null}
      {error ? <div className="mt-6"><Notice tone="error">{error}</Notice></div> : null}

      {list.length === 0 ? (
        <div className="pt-12">
          <p className="text-lg">Nothing saved yet.</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">Tap the heart on any piece to keep it here while you decide.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/new-in" className="btn btn-primary">Shop new arrivals</Link>
            <Link href="/brands" className="btn btn-secondary">Discover the makers</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {loading ? <div className="mt-10"><Spinner label="Loading saved pieces" /></div> : null}
          {gone > 0 ? (
            <p className="mt-10 text-xs text-muted">{gone === 1 ? 'One saved piece is' : `${gone} saved pieces are`} no longer available and {gone === 1 ? 'is' : 'are'} hidden.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

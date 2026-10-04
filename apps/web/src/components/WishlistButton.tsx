'use client';

import { Heart } from 'lucide-react';
import { useWishlist } from '@/context/WishlistProvider';

export function WishlistButton({ productId, className = '' }: { productId: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  return (
    <button
      type="button"
      onClick={() => void toggle(productId)}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`p-2 ${className}`}
    >
      <Heart size={16} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}

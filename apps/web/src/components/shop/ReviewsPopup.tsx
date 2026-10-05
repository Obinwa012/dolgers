'use client';

import { useState } from 'react';

interface Review {
  stars: number;
  text: string;
  size?: string;
}

/** Popup showing all product reviews. Opens when the star rating is clicked. */
export function ReviewsPopup({ reviews, rating }: { reviews: Review[]; rating: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm hover:opacity-80"
        aria-label={`View all ${reviews.length} reviews`}
      >
        <span className="text-amber-400" aria-hidden>
          {'★'.repeat(Math.round(rating))}
        </span>
        <span className="ml-2 text-muted">
          {rating.toFixed(1)} ({reviews.length})
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product reviews"
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto bg-paper p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="display text-[24px] md:text-[30px]">What buyers say</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl text-muted hover:text-ink"
                aria-label="Close reviews"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-muted">
              <span className="text-amber-400">{'★'.repeat(Math.round(rating))}</span>
              <span className="ml-2">{rating.toFixed(1)} · {reviews.length} reviews</span>
            </p>

            <ul className="mt-6 space-y-4">
              {reviews.map((review, i) => (
                <li key={i} className="border border-line px-6 py-5">
                  <p className="text-sm tracking-wide" aria-label={`${review.stars} out of 5 stars`}>
                    {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
                  </p>
                  <p className="mt-3 text-[15px] leading-relaxed">{review.text}</p>
                  {review.size ? (
                    <p className="mt-3 text-xs text-muted">
                      Verified buyer · Size {review.size}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

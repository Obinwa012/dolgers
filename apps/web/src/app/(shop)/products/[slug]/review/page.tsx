'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Review submission form for verified Dolgers purchases.
 * URL: /products/[slug]/review?order=ORDER_ID&email=EMAIL
 *
 * Tied to the order - verifies purchase before accepting.
 * Reviews show as "Verified Dolgers purchase".
 */
export default function ReviewFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') || '';
  const email = searchParams.get('email') || '';

  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlug: slug,
          orderId,
          email,
          stars,
          text,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message || 'Thank you for your review!' });
        setText('');
      } else {
        setResult({ success: false, message: data.error || 'Something went wrong.' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!orderId || !email) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-medium">Write a review</h1>
        <p className="mt-4 text-muted">
          To write a review, please use the link from your delivery email.
          It contains your order details for verification.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-medium">Write a review</h1>
      <p className="mt-2 text-sm text-muted">
        Share your honest experience. Your words help other shoppers show up right.
      </p>

      {result ? (
        <div className={`mt-8 rounded border p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <p className="text-sm">{result.message}</p>
        </div>
      ) : null}

      {!result?.success ? (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium">Your rating</label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={`text-3xl ${n <= stars ? 'text-amber-400' : 'text-stone-300'}`}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-text" className="block text-sm font-medium">
              Your review
            </label>
            <textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              minLength={10}
              required
              placeholder="How did it fit? How is the quality? Would you recommend it?"
              className="mt-2 w-full rounded border border-line-strong p-3 text-sm"
            />
            <p className="mt-1 text-xs text-muted">Minimum 10 characters. Be honest, specifics help.</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit review'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

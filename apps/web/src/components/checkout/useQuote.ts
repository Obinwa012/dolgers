'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DeliveryMethod, PricedCart } from '@dolgers/shared';

export interface QuoteState {
  quote: PricedCart | null;
  loading: boolean;
  error: string | null;
}

/**
 * Prices the bag on the server (POST /api/cart/quote) whenever the lines, delivery or promo
 * code change. The browser never computes a price; this is display only, and checkout prices
 * everything again before the charge.
 */
export function useQuote(
  lines: { sku: string; quantity: number }[],
  delivery: DeliveryMethod = 'standard',
  promoCode: string | null = null,
  enabled = true,
): QuoteState {
  const body = useMemo(
    () => JSON.stringify({ lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })), delivery, promoCode: promoCode || null }),
    [lines, delivery, promoCode],
  );
  const [state, setState] = useState<QuoteState>({ quote: null, loading: enabled, error: null });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    // Small debounce so tapping + three times sends one request.
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests. Please wait a moment.' : 'We could not price your bag.');
        const quote = (await res.json()) as PricedCart;
        setState({ quote, loading: false, error: null });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'We could not price your bag.' }));
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [body, enabled]);

  return state;
}

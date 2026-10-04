'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type Stripe } from '@stripe/stripe-js';
import { useState, type ReactNode } from 'react';
import { formatMoney, type Address, type Cents } from '@dolgers/shared';
import { Notice } from '@/components/ui';
import { publicEnv } from '@/lib/env';
import { fullName } from './format';

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise && publicEnv.stripePublishableKey) stripePromise = loadStripe(publicEnv.stripePublishableKey);
  return stripePromise;
}

// Stripe's form drawn in the DOLGERS style: square corners, near-black ink, Jost.
const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0e0e0e',
    colorText: '#0e0e0e',
    colorTextSecondary: '#5e5e5e',
    colorDanger: '#a23b2a',
    colorBackground: '#ffffff',
    fontFamily: 'Jost, ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '14px',
    borderRadius: '0px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #d9d7d3', boxShadow: 'none', padding: '14px' },
    '.Input:focus': { border: '1px solid #0e0e0e', boxShadow: 'none' },
    '.Label': { color: '#5e5e5e', fontSize: '12px' },
    '.AccordionItem': { border: '1px solid #d9d7d3', boxShadow: 'none' },
    '.AccordionItem--selected': { border: '1px solid #0e0e0e' },
  },
};

export interface PaymentFormProps {
  clientSecret: string;
  orderId: string;
  total: Cents;
  email: string;
  /** Returns the billing address to send, or null when the billing form has errors. */
  getBilling(): Address | null;
  /** Disables the button, e.g. once the stock hold has ended. */
  blocked?: boolean;
  onPaid(): void;
  /** The PaymentIntent can no longer be paid (expired or cancelled). */
  onStale(): void;
  /** Rendered between the payment methods and the button (billing address). */
  children?: ReactNode;
  back: ReactNode;
}

/** Stripe Payment Element (card, wallets, pay in instalments) and the PLACE ORDER button. */
export function PaymentForm(props: PaymentFormProps) {
  const stripe = getStripe();
  if (!stripe) return <Notice tone="error">Payments are not configured on this site yet.</Notice>;
  return (
    <Elements
      key={props.clientSecret}
      stripe={stripe}
      options={{
        clientSecret: props.clientSecret,
        appearance,
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500&display=swap' }],
      }}
    >
      <InnerForm {...props} />
    </Elements>
  );
}

function InnerForm({ orderId, total, email, getBilling, blocked, onPaid, onStale, children, back }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeOrder = async () => {
    if (!stripe || !elements || busy) return;
    setError(null);
    const billing = getBilling();
    if (!billing) {
      setError('Check your billing address.');
      return;
    }
    setBusy(true);
    try {
      const { error: err, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/checkout/confirmed/${orderId}`,
          payment_method_data: {
            billing_details: {
              name: fullName(billing),
              email,
              ...(billing.phone ? { phone: billing.phone } : {}),
              address: {
                line1: billing.line1,
                line2: billing.line2 || '',
                city: billing.city,
                state: billing.state,
                postal_code: billing.postalCode,
                country: 'US',
              },
            },
          },
        },
      });
      if (err) {
        if (err.code === 'payment_intent_unexpected_state') {
          onStale();
          setError('This payment session has ended. Continue to payment again to refresh it; you have not been charged.');
        } else if (err.type === 'card_error' || err.type === 'validation_error') {
          setError(err.message ?? 'Your payment details need another look.');
        } else {
          setError('We could not take the payment. You have not been charged; please try again.');
        }
        return;
      }
      if (paymentIntent && ['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) {
        onPaid();
        return;
      }
      setError('Your payment was not completed. Try again, or choose another way to pay.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: true },
          fields: { billingDetails: { name: 'never', email: 'never', address: 'never' } },
          business: { name: 'DOLGERS' },
        }}
      />
      {!ready ? <p className="mt-3 text-xs text-muted">Loading secure payment form…</p> : null}

      {children}

      {error ? <div className="mt-6"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mt-10 flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
        {back}
        <button
          type="button"
          onClick={() => void placeOrder()}
          disabled={!stripe || !ready || busy || blocked}
          className="btn btn-primary w-full sm:w-auto sm:min-w-[232px]"
        >
          {busy ? 'Placing order…' : `Place order · ${formatMoney(total)}`}
        </button>
      </div>
    </div>
  );
}

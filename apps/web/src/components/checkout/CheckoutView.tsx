'use client';

import { ChevronDown } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { z } from 'zod';
import {
  DELIVERY,
  DELIVERY_METHODS,
  RESERVATION_MINUTES,
  formatMoney,
  type Address,
  type DeliveryMethod,
  type OrderTotals,
  type SavedAddress,
} from '@dolgers/shared';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { useBag } from '@/context/BagProvider';
import { firebaseEnabled, publicEnv } from '@/lib/env';
import { accountApi, createCheckout, errorMessage, type CheckoutSession } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';
import { AddressFields, emptyAddress, validateAddress, type AddressDraft, type FieldErrors } from './AddressFields';
import { CheckoutSteps } from './CheckoutSteps';
import { addressOneLine, deliveryPrice, deliverySummary, fullName, groupByVendor, plural } from './format';
import { SummaryLines, TotalsRows, type SummaryLine } from './OrderSummary';
import { PaymentForm } from './PaymentForm';
import { bagNotice, savedPromo } from './storage';
import { useNow } from './useNow';
import { useQuote } from './useQuote';

type Step = 'information' | 'payment';
const emailSchema = z.email().max(200);
const paymentsReady = firebaseEnabled && Boolean(publicEnv.stripePublishableKey);

export function CheckoutView() {
  const router = useRouter();
  const { lines, hydrated, clear } = useBag();
  const { user, isMember, ensureSession } = useAuth();

  const [step, setStep] = useState<Step>('information');
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [address, setAddress] = useState<AddressDraft>(emptyAddress);
  const [delivery, setDelivery] = useState<DeliveryMethod>('standard');
  const [promo, setPromo] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [sessionKey, setSessionKey] = useState('');
  const [stale, setStale] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [sameBilling, setSameBilling] = useState(true);
  const [billing, setBilling] = useState<AddressDraft>(emptyAddress);
  const [billingErrors, setBillingErrors] = useState<FieldErrors>({});
  const topRef = useRef<HTMLDivElement>(null);
  const now = useNow(15_000);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setPromo(savedPromo.get());
  }, []);

  // Members start with their email and default saved address.
  useEffect(() => {
    const fb = firebase();
    if (!fb || !user || user.isAnonymous) return;
    let live = true;
    const fillEmail = () => {
      if (live && user.email) setEmail((e) => e || user.email!);
    };
    getDocs(collection(fb.db, 'users', user.uid, 'addresses'))
      .then((snap) => {
        fillEmail();
        if (!live) return;
        const list = snap.docs.map((d) => d.data() as SavedAddress);
        setSaved(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) setAddress((cur) => (cur.firstName || cur.line1 ? cur : toDraft(preferred)));
      })
      .catch(fillEmail);
    return () => { live = false; };
  }, [user]);

  const { quote, loading: quoting } = useQuote(lines, delivery, promo, hydrated && lines.length > 0 && !placed);
  const parcels = useMemo(() => groupByVendor(lines), [lines]);

  const summaryLines: SummaryLine[] = useMemo(() => {
    const priced = new Map(quote?.lines.map((l) => [l.sku, l]) ?? []);
    return parcels.flatMap((g) => g.lines).map((l) => ({
      sku: l.sku, vendorName: l.vendorName, title: l.title, colour: l.colour, size: l.size, quantity: l.quantity,
      image: l.image, lineTotal: priced.get(l.sku)?.lineTotal ?? null,
    }));
  }, [quote, parcels]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!hydrated) {
    return <div className="mx-auto max-w-[1120px] px-4 py-24 md:px-10"><Spinner label="Loading checkout" /></div>;
  }

  if (placed) {
    return <div className="mx-auto max-w-[1120px] px-4 py-24 md:px-10"><Spinner label="Confirming your order" /></div>;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-20 md:px-10">
        <h1 className="display text-[36px]">Your bag is empty</h1>
        <p className="mt-4 text-sm text-muted">Add a few pieces, then come back to check out.</p>
        <Link href="/" className="btn btn-primary mt-8">Continue shopping</Link>
      </div>
    );
  }

  const problems = quote?.problems ?? [];
  const sendToBag = (message: string) => {
    bagNotice.set(message);
    router.push('/bag');
  };

  const continueToPayment = async (e?: FormEvent) => {
    e?.preventDefault();
    setFormError(null);
    const next: FieldErrors = {};
    const emailCheck = emailSchema.safeParse(email.trim());
    if (!emailCheck.success) next.email = 'Enter an email address, like you@example.com.';
    const checked = validateAddress(address);
    if (!checked.ok) Object.assign(next, checked.errors);
    setErrors(next);
    if (Object.keys(next).length || !checked.ok) {
      setFormError('Please check the highlighted fields.');
      scrollTop();
      return;
    }
    if (problems.length) {
      sendToBag('Some pieces in your bag are no longer available in the quantity you chose. We have marked them below.');
      return;
    }
    if (!paymentsReady) {
      setStep('payment');
      scrollTop();
      return;
    }

    const input = {
      lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      email: email.trim(),
      shippingAddress: checked.value,
      billingAddress: null,
      delivery,
      promoCode: promo,
      marketingOptIn: optIn,
    };
    const key = JSON.stringify(input);
    // Nothing changed since the last attempt and the hold is still good: reuse it.
    if (session && !stale && key === sessionKey && session.expiresAt - Date.now() > 2 * 60_000) {
      setStep('payment');
      scrollTop();
      return;
    }

    setSubmitting(true);
    try {
      await ensureSession();
      const s = await createCheckout({ ...input, replaceOrderId: session?.orderId ?? null });
      setSession(s);
      setSessionKey(key);
      setStale(false);
      setStep('payment');
      scrollTop();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const details = (err as { details?: { problems?: unknown[] } }).details;
      if (code === 'functions/failed-precondition' && details?.problems?.length) {
        sendToBag('Some pieces sold out while you were checking out. We have marked them below so you can adjust your bag.');
      } else if (code === 'functions/aborted') {
        sendToBag(errorMessage(err));
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const backToInformation = () => {
    setStep('information');
    scrollTop();
  };

  const leaveToBag = () => {
    // Release the stock hold from an earlier attempt rather than leave it for 30 minutes.
    if (session) void accountApi({ action: 'cancelPendingOrder', data: { orderId: session.orderId } }).catch(() => undefined);
  };

  const getBilling = (): Address | null => {
    const shipping = validateAddress(address);
    if (!shipping.ok) return null;
    if (sameBilling) return shipping.value;
    const b = validateAddress(billing);
    if (!b.ok) {
      setBillingErrors(b.errors);
      return null;
    }
    setBillingErrors({});
    return b.value;
  };

  const onPaid = () => {
    if (!session) return;
    setPlaced(true);
    savedPromo.set(null);
    clear();
    router.push(`/checkout/confirmed/${session.orderId}`);
  };

  // Totals: the checkout session's (tax included) on the payment step, the live quote before.
  const showSessionTotals = step === 'payment' && session && !stale;
  const totals: Pick<OrderTotals, 'subtotal' | 'discount' | 'shipping' | 'total'> & { tax: number | null } | null = showSessionTotals
    ? session.totals
    : quote
      ? { ...quote.totals, tax: null }
      : null;
  const remaining = session ? session.expiresAt - now : 0;
  const expired = !!session && remaining <= 0;

  const summary = (
    <OrderSummaryPanel
      lines={summaryLines}
      totals={totals}
      promoCode={quote?.promo?.applied ? quote.promo.code : null}
      taxLabel={step === 'payment' ? 'Tax' : 'Estimated tax'}
      loading={quoting && !quote}
    />
  );

  return (
    <div ref={topRef} className="mx-auto w-full max-w-[1120px] scroll-mt-4 px-4 pb-20 md:px-10">
      <MobileSummary total={totals?.total ?? null}>{summary}</MobileSummary>

      <div className="grid gap-12 pt-8 md:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[72px]">
        <div className="min-w-0">
          <CheckoutSteps current={step} onInformation={backToInformation} />
          <h1 className="sr-only">Checkout</h1>

          {formError ? <div className="mt-8"><Notice tone="error">{formError}</Notice></div> : null}
          {problems.length > 0 && step === 'information' ? (
            <div className="mt-8">
              <Notice tone="error">
                Some pieces in your bag are no longer available as chosen.{' '}
                <Link href="/bag" className="underline underline-offset-2">Review your bag</Link>
              </Notice>
            </div>
          ) : null}

          {step === 'information' ? (
            <form onSubmit={continueToPayment} noValidate className="mt-10">
              <section aria-labelledby="contact-heading">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 id="contact-heading" className="label">Contact</h2>
                  {isMember ? (
                    <p className="text-sm text-muted">Signed in as {user?.email}</p>
                  ) : (
                    <p className="text-sm text-muted">
                      Have an account?{' '}
                      <Link href="/sign-in?next=/checkout" className="text-ink underline underline-offset-4">Sign in</Link>
                    </p>
                  )}
                </div>
                <div className="mt-5">
                  <label htmlFor="checkout-email" className="field-label">Email</label>
                  <input
                    id="checkout-email"
                    type="email"
                    className={`field ${errors.email ? 'border-danger' : ''}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    maxLength={200}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'checkout-email-error' : 'checkout-email-hint'}
                  />
                  {errors.email ? (
                    <p id="checkout-email-error" className="mt-1.5 text-xs text-danger">{errors.email}</p>
                  ) : (
                    <p id="checkout-email-hint" className="mt-1.5 text-xs text-muted">We send your receipt and shipping updates here.</p>
                  )}
                </div>
                <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                  Email me about new arrivals and private sales
                </label>
              </section>

              <section aria-labelledby="ship-heading" className="mt-12">
                <h2 id="ship-heading" className="label">Shipping address</h2>
                {saved.length > 1 ? (
                  <div className="mt-5">
                    <label htmlFor="saved-address" className="field-label">Saved addresses</label>
                    <select
                      id="saved-address"
                      className="field"
                      defaultValue=""
                      onChange={(e) => {
                        const a = saved.find((s) => s.id === e.target.value);
                        if (a) setAddress(toDraft(a));
                      }}
                    >
                      <option value="" disabled>Choose a saved address</option>
                      {saved.map((a) => (
                        <option key={a.id} value={a.id}>{fullName(a)}, {addressOneLine(a)}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="mt-5">
                  <AddressFields idPrefix="ship" value={address} onChange={setAddress} errors={errors} />
                </div>
              </section>

              <fieldset className="mt-12">
                <legend className="label">Delivery</legend>
                <div className="mt-5 space-y-3">
                  {DELIVERY_METHODS.map((m) => {
                    const checked = delivery === m;
                    return (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-center gap-4 border px-5 py-5 ${checked ? 'border-ink' : 'border-line-strong'}`}
                      >
                        <input
                          type="radio"
                          name="delivery"
                          value={m}
                          checked={checked}
                          onChange={() => setDelivery(m)}
                          className="h-4 w-4 accent-ink"
                        />
                        <span className="flex-1">
                          <span className="block text-[15px]">{DELIVERY[m].label}</span>
                          <span className="mt-0.5 block text-xs text-muted">{DELIVERY[m].detail}</span>
                        </span>
                        <span className="text-sm font-medium">{deliveryPrice(DELIVERY[m].price)}</span>
                      </label>
                    );
                  })}
                </div>
                {parcels.length > 0 ? (
                  <div className="mt-3 bg-stone px-5 py-5">
                    <p className="text-sm font-medium">Your order ships in {plural(parcels.length, 'parcel')}</p>
                    <ul className="mt-3 space-y-2 text-xs text-muted">
                      {parcels.map((g) => (
                        <li key={g.vendorId} className="flex justify-between gap-4">
                          <span className="shrink-0">From {g.vendorName}</span>
                          <span className="text-right">{g.lines.map((l) => l.title).join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </fieldset>

              <div className="mt-12 flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/bag" onClick={leaveToBag} className="link-underline self-center sm:self-auto">Return to bag</Link>
                <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-[232px]" disabled={submitting || (quoting && !quote)}>
                  {submitting ? 'Holding your items…' : 'Continue to payment'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-10">
              <dl className="border border-line-strong text-sm">
                <ReviewRow label="Contact" value={email.trim()} onChange={backToInformation} />
                <ReviewRow label="Ship to" value={`${fullName(address)}, ${addressOneLine(address)}`} onChange={backToInformation} />
                <ReviewRow label="Delivery" value={deliverySummary(delivery)} onChange={backToInformation} last />
              </dl>

              <section aria-labelledby="pay-heading" className="mt-12">
                <h2 id="pay-heading" className="label">Payment</h2>
                <p className="mt-2 text-sm text-muted">One payment covers every maker in your order.</p>

                {session && !expired && !stale ? (
                  <p className="mt-3 text-xs text-muted" role="status">
                    We&apos;re holding your items for {RESERVATION_MINUTES} minutes
                    <span className="text-faint"> · {Math.max(1, Math.ceil(remaining / 60_000))} min left</span>
                  </p>
                ) : null}

                <div className="mt-6">
                  {!paymentsReady ? (
                    <Notice>
                      Payments are not set up on this preview, so orders cannot be placed yet. Nothing has been held or charged.
                    </Notice>
                  ) : session && (expired || stale) ? (
                    <div className="space-y-4">
                      <Notice tone="error">
                        {expired
                          ? 'Your 30-minute hold has ended, so your items have been released. Check them again to continue; you have not been charged.'
                          : 'This payment session has ended. Refresh it to continue; you have not been charged.'}
                      </Notice>
                      <button type="button" className="btn btn-secondary" onClick={() => void continueToPayment()} disabled={submitting}>
                        {submitting ? 'Checking…' : 'Check my items again'}
                      </button>
                    </div>
                  ) : session ? (
                    <PaymentForm
                      clientSecret={session.clientSecret}
                      orderId={session.orderId}
                      total={session.totals.total}
                      email={email.trim()}
                      getBilling={getBilling}
                      blocked={expired}
                      onPaid={onPaid}
                      onStale={() => setStale(true)}
                      back={<button type="button" onClick={backToInformation} className="link-underline self-center sm:self-auto">Return to information</button>}
                    >
                      <BillingSection
                        same={sameBilling}
                        onSame={setSameBilling}
                        billing={billing}
                        onBilling={setBilling}
                        errors={billingErrors}
                      />
                    </PaymentForm>
                  ) : null}
                </div>
                {!paymentsReady ? (
                  <div className="mt-10">
                    <button type="button" onClick={backToInformation} className="link-underline">Return to information</button>
                  </div>
                ) : null}
                <p className="mt-6 text-xs text-muted">
                  By placing your order you agree to DOLGERS&apos;s{' '}
                  <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{' '}
                  <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
                </p>
              </section>
            </div>
          )}
        </div>

        <aside aria-label="Order summary" className="hidden self-start bg-stone p-9 lg:sticky lg:top-8 lg:block">
          {summary}
        </aside>
      </div>
    </div>
  );
}

function toDraft(a: SavedAddress): AddressDraft {
  return {
    firstName: a.firstName, lastName: a.lastName, line1: a.line1, line2: a.line2 ?? '', city: a.city,
    state: a.state, postalCode: a.postalCode, country: 'US', phone: a.phone ?? '',
  };
}

function ReviewRow({ label, value, onChange, last }: { label: string; value: string; onChange(): void; last?: boolean }) {
  return (
    <div className={`flex items-start gap-4 px-5 py-4 ${last ? '' : 'border-b border-line'}`}>
      <dt className="w-20 shrink-0 text-muted sm:w-32">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
      <dd>
        <button type="button" onClick={onChange} className="text-sm underline underline-offset-4" aria-label={`Change ${label.toLowerCase()}`}>
          Change
        </button>
      </dd>
    </div>
  );
}

function BillingSection({
  same, onSame, billing, onBilling, errors,
}: {
  same: boolean;
  onSame(v: boolean): void;
  billing: AddressDraft;
  onBilling(a: AddressDraft): void;
  errors: FieldErrors;
}) {
  return (
    <section aria-labelledby="billing-heading" className="mt-12">
      <h2 id="billing-heading" className="label">Billing address</h2>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-ink" checked={same} onChange={(e) => onSame(e.target.checked)} />
        Same as shipping address
      </label>
      {!same ? (
        <div className="mt-6">
          <AddressFields idPrefix="bill" section="billing" value={billing} onChange={onBilling} errors={errors} showPhone={false} />
        </div>
      ) : null}
    </section>
  );
}

function OrderSummaryPanel({
  lines, totals, promoCode, taxLabel, loading,
}: {
  lines: SummaryLine[];
  totals: { subtotal: number; discount: number; shipping: number; tax: number | null; total: number } | null;
  promoCode: string | null;
  taxLabel: string;
  loading: boolean;
}) {
  return (
    <div>
      <h2 className="display text-[28px]">Order summary</h2>
      <div className="mt-7">
        <SummaryLines lines={lines} />
      </div>
      <div className="mt-7 border-t border-line-strong pt-6">
        {loading || !totals ? (
          <Spinner label="Pricing your bag" />
        ) : (
          <TotalsRows
            rows={[
              { label: 'Subtotal', value: formatMoney(totals.subtotal) },
              ...(totals.discount > 0 ? [{ label: promoCode ? `Promo ${promoCode}` : 'Discount', value: `−${formatMoney(totals.discount)}` }] : []),
              { label: 'Delivery', value: deliveryPrice(totals.shipping) },
              totals.tax === null
                ? { label: taxLabel, value: 'Calculated at next step', muted: true }
                : { label: taxLabel, value: formatMoney(totals.tax) },
            ]}
            total={{ label: 'Total', value: formatMoney(totals.total) }}
          />
        )}
      </div>
    </div>
  );
}

function MobileSummary({ total, children }: { total: number | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="-mx-4 border-b border-line bg-stone lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-summary"
        className="flex w-full items-center justify-between px-4 py-4 text-sm"
      >
        <span className="flex items-center gap-2">
          {open ? 'Hide order summary' : 'Show order summary'}
          <ChevronDown size={14} strokeWidth={1.5} className={open ? 'rotate-180' : ''} aria-hidden />
        </span>
        <span className="font-medium">{total === null ? '—' : formatMoney(total)}</span>
      </button>
      <div id="mobile-summary" hidden={!open} className="px-4 pb-6">
        {children}
      </div>
    </div>
  );
}

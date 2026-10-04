'use client';

import { Check } from 'lucide-react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatMoney, type Order, type VendorOrder } from '@dolgers/shared';
import { MIN_PASSWORD, authErrorMessage } from '@/components/account/authHelpers';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { useBag } from '@/context/BagProvider';
import { accountApi } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';
import { deliveryPrice, fullName, groupByVendor, paymentLabel, plural, stateName } from './format';
import { TotalsRows } from './OrderSummary';
import { ShipmentCard } from './ShipmentCard';
import { savedPromo } from './storage';

type Load = { orderId: string; order: Order | null; error: 'denied' | 'missing' | null };

export function ConfirmationView() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { ready, enabled, user } = useAuth();
  const { clear } = useBag();
  const [load, setLoad] = useState<Load | null>(null);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  // Set when the buyer comes back from a bank or pay-later page that did not complete.
  const [redirectFailed] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('redirect_status') === 'failed',
  );
  const [retrying, setRetrying] = useState(false);

  // Back from a redirect-based payment (bank or pay-later page): the bag was not cleared yet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('payment_intent')) return;
    if (params.get('redirect_status') === 'succeeded' || params.get('redirect_status') === 'processing') {
      clear();
      savedPromo.set(null);
    }
    router.replace(`/checkout/confirmed/${orderId}`);
  }, [clear, orderId, router]);

  useEffect(() => {
    const fb = firebase();
    if (!fb || !user) return;
    return onSnapshot(
      doc(fb.db, 'orders', orderId),
      (snap) => setLoad({ orderId, order: snap.exists() ? (snap.data() as Order) : null, error: snap.exists() ? null : 'missing' }),
      () => setLoad({ orderId, order: null, error: 'denied' }),
    );
  }, [user, orderId]);

  const order = load?.orderId === orderId ? load.order : null;
  const paid = !!order?.paidAt;

  useEffect(() => {
    const fb = firebase();
    if (!fb || !user || !paid) return;
    const q = query(collection(fb.db, 'vendorOrders'), where('uid', '==', user.uid), where('orderId', '==', orderId));
    return onSnapshot(q, (snap) => setVendorOrders(snap.docs.map((d) => d.data() as VendorOrder)), () => undefined);
  }, [user, orderId, paid]);

  const shipments = useMemo(() => {
    if (!order) return [];
    const byVendor = new Map(vendorOrders.filter((v) => v.orderId === order.id).map((v) => [v.vendorId, v]));
    return groupByVendor(order.lines).map((g) => {
      const vo = byVendor.get(g.vendorId);
      return {
        vendorId: g.vendorId,
        vendorName: g.vendorName,
        lines: vo?.lines ?? g.lines,
        status: vo?.status ?? 'preparing',
        estimatedDelivery: vo?.estimatedDelivery ?? null,
        tracking: vo?.tracking ?? null,
      };
    });
  }, [order, vendorOrders]);

  const shell = (children: ReactNode) => (
    <div className="container-page py-16 text-center md:py-24">{children}</div>
  );

  if (!enabled) {
    return shell(<Notice>Orders are not available in demo mode.</Notice>);
  }
  if (!ready || (user && !load && !order)) {
    return shell(<Spinner label="Loading your order" />);
  }
  if (!user || load?.error === 'denied' || load?.error === 'missing') {
    return shell(
      <>
        <h1 className="display text-[36px]">We could not find this order here</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          Orders can be viewed from the browser they were placed in, or from your account. Your receipt email has every detail.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/sign-in?next=${encodeURIComponent(`/account/orders/${orderId}`)}`} className="btn btn-primary">Sign in</Link>
          <Link href="/" className="btn btn-secondary">Continue shopping</Link>
        </div>
      </>,
    );
  }
  if (!order) return shell(<Spinner label="Loading your order" />);

  if (order.status === 'pending_payment' && !order.paidAt && redirectFailed) {
    const retry = async () => {
      setRetrying(true);
      // Release this attempt's stock hold, then start a fresh checkout with the same bag.
      await accountApi({ action: 'cancelPendingOrder', data: { orderId: order.id } }).catch(() => undefined);
      router.push('/checkout');
    };
    return shell(
      <>
        <h1 className="display text-[36px]">Your payment was not completed</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          Nothing was charged. Your bag is just as you left it, so you can try again or choose another way to pay.
        </p>
        <button type="button" onClick={() => void retry()} disabled={retrying} className="btn btn-primary mt-8">
          {retrying ? 'One moment…' : 'Return to checkout'}
        </button>
      </>,
    );
  }

  if (order.status === 'pending_payment' && !order.paidAt) {
    return shell(
      <div role="status" className="flex flex-col items-center">
        <span className="h-10 w-10 animate-spin rounded-full border border-faint border-t-ink" aria-hidden />
        <h1 className="display mt-8 text-[34px]">Confirming your payment…</h1>
        <p className="mt-3 text-sm text-muted">This usually takes a few seconds. Please keep this page open.</p>
      </div>,
    );
  }

  if (!order.paidAt) {
    return shell(
      <>
        <h1 className="display text-[36px]">This order was not completed</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          The payment did not go through, so nothing was charged and your items were released. Your bag is ready if you would like to try again.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/bag" className="btn btn-primary">Go to bag</Link>
          <Link href="/help/contact" className="btn btn-secondary">Contact us</Link>
        </div>
      </>,
    );
  }

  const a = order.shippingAddress;
  const isGuest = user.isAnonymous;
  const t = order.totals;

  return (
    <div className="container-page pb-20">
      <section className="pt-12 text-center md:pt-20">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-ink" aria-hidden>
          <Check size={20} strokeWidth={1.25} />
        </span>
        <p className="label mt-7 text-muted">Order {order.number}</p>
        <h1 className="display mx-auto mt-5 max-w-[640px] text-[40px] md:text-[64px]">Thank you. Your order is confirmed.</h1>
        <p className="mx-auto mt-6 max-w-[500px] text-[15px] leading-relaxed text-muted">
          A receipt is on its way to {order.email}. We&apos;ll email you again as each maker ships their part of your order.
        </p>
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label">{plural(shipments.length, 'shipment')}</h2>
            <p className="text-xs text-muted">Each maker ships separately</p>
          </div>
          <div className="mt-5 space-y-4">
            {shipments.map((s) => (
              <ShipmentCard key={s.vendorId} vendorName={s.vendorName} status={s.status} lines={s.lines} estimatedDelivery={s.estimatedDelivery} tracking={s.tracking} />
            ))}
          </div>
          {isGuest ? <SaveDetails order={order} /> : null}
        </div>

        <aside className="self-start">
          <div className="bg-stone p-8">
            <h2 className="display text-[28px]">Summary</h2>
            <div className="mt-6">
              <TotalsRows
                rows={[
                  { label: 'Subtotal', value: formatMoney(t.subtotal) },
                  ...(t.discount > 0 ? [{ label: order.promoCode ? `Promo ${order.promoCode}` : 'Discount', value: `−${formatMoney(t.discount)}` }] : []),
                  { label: 'Delivery', value: deliveryPrice(t.shipping) },
                  { label: 'Tax', value: formatMoney(t.tax) },
                ]}
                total={{ label: 'Total paid', value: formatMoney(t.total) }}
              />
            </div>
          </div>
          <div className="mt-8 space-y-6 text-sm">
            <div>
              <h2 className="label">Delivering to</h2>
              <address className="mt-2 not-italic leading-relaxed text-ink-2">
                {fullName(a)}<br />
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                {a.city}, {stateName(a.state)} {a.postalCode}
              </address>
            </div>
            <div>
              <h2 className="label">Paid with</h2>
              <p className="mt-2 text-ink-2">{paymentLabel(order.paymentMethodSummary)}</p>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <Link href={isGuest ? '#save-details' : `/account/orders/${order.id}`} className="btn btn-primary w-full">Track order</Link>
            <Link href="/" className="btn btn-secondary w-full">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Guests can turn their checkout session into an account; the order stays with it. */
function SaveDetails({ order }: { order: Order }) {
  const { signUp } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      await signUp({
        email: order.email,
        password,
        firstName: order.shippingAddress.firstName,
        lastName: order.shippingAddress.lastName,
        marketingOptIn: order.marketingOptIn,
      });
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div id="save-details" className="mt-8 bg-stone p-6 sm:p-8">
        <h2 className="display text-[26px]">Your account is ready</h2>
        <p className="mt-3 text-sm text-muted">This order is saved to it. Follow every shipment from your account.</p>
        <Link href={`/account/orders/${order.id}`} className="btn btn-primary mt-6">View my order</Link>
      </div>
    );
  }

  return (
    <form id="save-details" onSubmit={submit} className="mt-8 scroll-mt-8 bg-stone p-6 sm:p-8" noValidate>
      <h2 className="display text-[26px]">Save your details for next time</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Create a password to track every shipment in one place and check out faster. Your account will use {order.email}.
      </p>
      <input type="email" name="email" value={order.email} autoComplete="username" readOnly hidden />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="guest-password" className="field-label">Password</label>
          <input
            id="guest-password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            aria-describedby="guest-password-hint"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </div>
      <p id="guest-password-hint" className="mt-2 text-xs text-muted">At least {MIN_PASSWORD} characters.</p>
      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
    </form>
  );
}

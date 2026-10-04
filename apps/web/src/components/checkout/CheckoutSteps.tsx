import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

export type CheckoutStep = 'information' | 'payment' | 'confirmation';

const STEPS: { id: 'bag' | CheckoutStep; label: string; short: string }[] = [
  { id: 'bag', label: 'Bag', short: 'Bag' },
  { id: 'information', label: 'Information', short: 'Information' },
  { id: 'payment', label: 'Payment', short: 'Payment' },
  { id: 'confirmation', label: 'Confirmation', short: 'Done' },
];

/** BAG / INFORMATION / PAYMENT / CONFIRMATION, as in checkout frames 08 and 09. */
export function CheckoutSteps({ current, onInformation }: { current: CheckoutStep; onInformation?: () => void }) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Checkout steps">
      <ol className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] sm:gap-5">
        {STEPS.map((s, i) => {
          const active = s.id === current;
          const done = i < index;
          const cls = `pb-1 ${active ? 'border-b border-ink text-ink' : done ? 'text-ink-2' : 'text-faint'}`;
          let content: ReactNode = <span className={cls} aria-current={active ? 'step' : undefined}>
            <span className="hidden sm:inline">{s.label}</span><span className="sm:hidden">{s.short}</span>
          </span>;
          if (s.id === 'bag') content = <Link href="/bag" className={`${cls} hover:text-ink`}>{s.label}</Link>;
          else if (s.id === 'information' && done && onInformation) {
            content = <button type="button" onClick={onInformation} className={`${cls} uppercase tracking-[0.16em] hover:text-ink`}>{s.label}</button>;
          }
          return (
            <Fragment key={s.id}>
              {i > 0 ? <li aria-hidden className={`text-faint ${s.id === 'information' ? 'hidden sm:block' : ''}`}>/</li> : null}
              <li className={s.id === 'bag' ? 'hidden sm:block' : ''}>{content}</li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

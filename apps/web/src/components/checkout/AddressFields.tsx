'use client';

import type { InputHTMLAttributes } from 'react';
import { US_STATES, addressSchema, type Address } from '@dolgers/shared';

export type AddressDraft = Address;
export type FieldErrors = Partial<Record<keyof Address | 'email', string>>;

export const emptyAddress: AddressDraft = {
  firstName: '', lastName: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US', phone: '',
};

const MESSAGES: Record<keyof Address, string> = {
  firstName: 'Enter a first name.',
  lastName: 'Enter a last name.',
  line1: 'Enter a street address.',
  line2: 'Keep this line under 120 characters.',
  city: 'Enter a city.',
  state: 'Choose a state.',
  postalCode: 'Enter a 5-digit ZIP code, like 10013.',
  country: 'We deliver within the United States only.',
  phone: 'Use digits only, with spaces, dashes or brackets if you like.',
};

/** Checks an address with the same schema the server uses. */
export function validateAddress(a: AddressDraft): { ok: true; value: Address } | { ok: false; errors: FieldErrors } {
  const result = addressSchema.safeParse({ ...a, country: 'US' });
  if (result.success) return { ok: true, value: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof Address;
    if (key && !errors[key]) errors[key] = MESSAGES[key] ?? 'Check this field.';
  }
  return { ok: false, errors };
}

/** US shipping or billing address fields, styled as in the checkout mockup. */
export function AddressFields({
  value,
  onChange,
  errors = {},
  idPrefix,
  section = 'shipping',
  showPhone = true,
  disabled,
}: {
  value: AddressDraft;
  onChange(next: AddressDraft): void;
  errors?: FieldErrors;
  idPrefix: string;
  section?: 'shipping' | 'billing';
  showPhone?: boolean;
  disabled?: boolean;
}) {
  const set = (key: keyof Address) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  const ac = (token: string) => `section-${idPrefix} ${section} ${token}`;

  const field = (key: keyof Address, label: string, autoComplete: string, extra: Partial<InputHTMLAttributes<HTMLInputElement>> = {}) => {
    const id = `${idPrefix}-${key}`;
    const err = errors[key];
    return (
      <div>
        <label htmlFor={id} className="field-label">{label}</label>
        <input
          id={id}
          className={`field ${err ? 'border-danger' : ''}`}
          value={value[key]}
          onChange={set(key)}
          autoComplete={ac(autoComplete)}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          disabled={disabled}
          {...extra}
        />
        {err ? <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">{err}</p> : null}
      </div>
    );
  };

  const stateId = `${idPrefix}-state`;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {field('firstName', 'First name', 'given-name', { maxLength: 60 })}
        {field('lastName', 'Last name', 'family-name', { maxLength: 60 })}
      </div>
      {field('line1', 'Address', 'address-line1', { maxLength: 120 })}
      {field('line2', 'Apartment, suite, etc. (optional)', 'address-line2', { maxLength: 120 })}
      <div className="grid gap-5 sm:grid-cols-3">
        {field('city', 'City', 'address-level2', { maxLength: 80 })}
        <div>
          <label htmlFor={stateId} className="field-label">State</label>
          <select
            id={stateId}
            className={`field appearance-auto ${errors.state ? 'border-danger' : ''}`}
            value={value.state}
            onChange={set('state')}
            autoComplete={ac('address-level1')}
            aria-invalid={errors.state ? true : undefined}
            aria-describedby={errors.state ? `${stateId}-error` : undefined}
            disabled={disabled}
          >
            <option value="">Select</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          {errors.state ? <p id={`${stateId}-error`} className="mt-1.5 text-xs text-danger">{errors.state}</p> : null}
        </div>
        {field('postalCode', 'ZIP code', 'postal-code', { inputMode: 'numeric', maxLength: 10 })}
      </div>
      <p className="text-xs text-muted">Country: United States. We deliver to US addresses only.</p>
      {showPhone ? field('phone', 'Phone, for delivery updates (optional)', 'tel', { type: 'tel', maxLength: 25 }) : null}
    </div>
  );
}

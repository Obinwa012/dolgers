'use client';

import { collection, deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { useState, type FormEvent } from 'react';
import type { SavedAddress } from '@dolgers/shared';
import { AddressFields, emptyAddress, validateAddress, type AddressDraft, type FieldErrors } from '@/components/checkout/AddressFields';
import { fullName, stateName } from '@/components/checkout/format';
import { Notice, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthProvider';
import { errorMessage } from '@/lib/firebase/api';
import { firebase } from '@/lib/firebase/client';
import { useMyAddresses } from './data';

const MAX_ADDRESSES = 10;

export function AddressesView() {
  const { user } = useAuth();
  const { data: addresses, loading, error: loadError } = useMyAddresses();
  const [editing, setEditing] = useState<{ id: string | null; draft: AddressDraft; isDefault: boolean } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const fb = firebase();
  if (!fb || !user) return null;
  const col = collection(fb.db, 'users', user.uid, 'addresses');

  const startNew = () => {
    setErrors({});
    setError(null);
    setEditing({ id: null, draft: emptyAddress, isDefault: addresses.length === 0 });
  };

  const startEdit = (a: SavedAddress) => {
    setErrors({});
    setError(null);
    setEditing({
      id: a.id,
      isDefault: a.isDefault,
      draft: { firstName: a.firstName, lastName: a.lastName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: 'US', phone: a.phone },
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const checked = validateAddress(editing.draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      const id = editing.id ?? doc(col).id;
      const isDefault = editing.isDefault || addresses.length === 0 || (addresses.length === 1 && editing.id === addresses[0].id);
      const record: SavedAddress = { id, ...checked.value, line2: checked.value.line2 ?? '', phone: checked.value.phone ?? '', country: 'US', isDefault };
      const batch = writeBatch(fb.db);
      batch.set(doc(col, id), record);
      if (isDefault) for (const other of addresses) if (other.id !== id && other.isDefault) batch.update(doc(col, other.id), { isDefault: false });
      await batch.commit();
      setEditing(null);
      setStatus('Address saved.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: SavedAddress) => {
    if (!window.confirm(`Delete the address for ${fullName(a)}?`)) return;
    try {
      await deleteDoc(doc(col, a.id));
      const rest = addresses.filter((x) => x.id !== a.id);
      if (a.isDefault && rest.length) await setDoc(doc(col, rest[0].id), { ...rest[0], isDefault: true });
      setStatus('Address deleted.');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const makeDefault = async (a: SavedAddress) => {
    try {
      const batch = writeBatch(fb.db);
      for (const other of addresses) if (other.isDefault && other.id !== a.id) batch.update(doc(col, other.id), { isDefault: false });
      batch.update(doc(col, a.id), { isDefault: true });
      await batch.commit();
      setStatus(`${fullName(a)} is now your default address.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[36px] md:text-[44px]">Addresses</h1>
        {!editing && addresses.length < MAX_ADDRESSES ? (
          <button type="button" className="btn btn-secondary" onClick={startNew}>Add an address</button>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-muted">Your default address is filled in for you at checkout. We deliver within the United States.</p>
      <p className="sr-only" aria-live="polite">{status}</p>

      {error ? <div className="mt-6"><Notice tone="error">{error}</Notice></div> : null}
      {loadError ? <div className="mt-6"><Notice tone="error">{loadError}</Notice></div> : null}

      {editing ? (
        <form onSubmit={save} noValidate className="mt-10 border border-line-strong p-5 sm:p-8">
          <h2 className="label">{editing.id ? 'Edit address' : 'New address'}</h2>
          <div className="mt-6">
            <AddressFields idPrefix="addr" value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} errors={errors} />
          </div>
          <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ink"
              checked={editing.isDefault}
              onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
            />
            Make this my default address
          </label>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
            <button type="button" className="text-sm underline underline-offset-4" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="mt-10">
        {loading ? (
          <Spinner />
        ) : addresses.length === 0 && !editing ? (
          <p className="text-sm text-muted">No saved addresses yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className={`border p-6 ${a.isDefault ? 'border-ink' : 'border-line-strong'}`}>
                {a.isDefault ? <p className="label mb-3 text-muted">Default</p> : null}
                <address className="not-italic text-sm leading-relaxed text-ink-2">
                  <span className="text-ink">{fullName(a)}</span><br />
                  {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                  {a.city}, {stateName(a.state)} {a.postalCode}<br />
                  {a.phone ? <>{a.phone}<br /></> : null}
                </address>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <button type="button" className="underline underline-offset-4" onClick={() => startEdit(a)}>Edit</button>
                  {!a.isDefault ? <button type="button" className="underline underline-offset-4" onClick={() => void makeDefault(a)}>Make default</button> : null}
                  <button type="button" className="text-muted underline underline-offset-4 hover:text-danger" onClick={() => void remove(a)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

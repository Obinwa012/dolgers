'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ActionButton } from '@/components/ActionButton.tsx';
import { btn, Card, Field, input } from '@/components/ui.tsx';
import { addAdmin, removeAdmin } from '@/server/actions/auth.ts';

export function AdminsSettings({ admins, me }: { admins: { uid: string; email: string; createdAt: number | null }[]; me: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <Card title="Admins">
        <ul className="divide-y divide-line">
          {admins.map((a) => (
            <li key={a.uid} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                {a.email || a.uid}
                {a.uid === me && <span className="ml-2 text-xs text-ink-soft">(you)</span>}
              </span>
              {a.uid !== me && (
                <ActionButton variant="danger" action={() => removeAdmin(a.uid)} confirm={`Remove ${a.email} as an admin? They are signed out at once.`}>
                  Remove
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add an admin">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await addAdmin(email, password);
              setMsg(r.ok ? { ok: true, text: `${email} can now sign in.` } : { ok: false, text: r.error });
              if (r.ok) {
                setEmail('');
                setPassword('');
                router.refresh();
              }
            });
          }}
        >
          <Field label="Email">
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" hint="Only for a new account (8+ characters). An existing account keeps its password.">
            <input className={input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
          <button className={btn.primary} disabled={pending || !email}>{pending ? 'Adding…' : 'Add admin'}</button>
        </form>
      </Card>
    </div>
  );
}

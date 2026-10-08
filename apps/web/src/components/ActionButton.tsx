'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn } from './ui.tsx';

type R = { ok: true } | { ok: false; error: string };

/** A button that runs a server action, shows progress and errors, then refreshes the page. */
export function ActionButton({
  action,
  children,
  variant = 'secondary',
  confirm,
  then,
}: {
  action: () => Promise<R>;
  children: React.ReactNode;
  variant?: keyof typeof btn;
  confirm?: string;
  then?: (r: R) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={btn[variant]}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError('');
          start(async () => {
            const r = await action().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Something went wrong.' }));
            if (!r.ok) setError(r.error);
            else if (then) then(r);
            else router.refresh();
          });
        }}
      >
        {pending ? 'Working…' : children}
      </button>
      {error && <span role="alert" className="max-w-xs text-xs text-bad">{error}</span>}
    </span>
  );
}

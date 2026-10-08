'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge, btn, Card, Field, input, KV } from '@/components/ui.tsx';
import { ago, when } from '@/lib/format.ts';
import { connectAliExpress, saveAliExpressKeys, saveAliExpressTokens, testAliExpress } from '@/server/actions/settings.ts';
import type { SetupStatus } from '@/server/queries.ts';

export function AliExpressSettings({ setup, callbackUrl, connected, error }: { setup: SetupStatus; callbackUrl: string; connected: boolean; error: string | null }) {
  const router = useRouter();
  const [appKey, setAppKey] = useState(setup.aeAppKey ?? '');
  const [secret, setSecret] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(connected ? { ok: true, text: 'AliExpress connected.' } : error ? { ok: false, text: error } : null);
  const [pending, start] = useTransition();
  const [tok, setTok] = useState({ access: '', refresh: '', expires: '' });
  const now = Date.now();
  const expired = setup.aeExpiresAt !== null && setup.aeExpiresAt < now;

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, okText: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? okText } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      {msg && (
        <p role="status" className={`rounded-md px-4 py-2 text-sm lg:col-span-2 ${msg.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>
          {msg.text}
        </p>
      )}
      <Card title="Connection">
        <KV
          rows={[
            ['App key', setup.aeAppKey ?? <span className="text-ink-soft">not set</span>],
            ['App secret', setup.aeKeys ? 'saved' : <span className="text-ink-soft">not set</span>],
            [
              'Account',
              setup.aeConnected ? (
                <Badge tone={expired ? 'warn' : 'good'}>{expired ? 'token expired, renewing on next use' : 'connected'}</Badge>
              ) : (
                <Badge tone="bad">not connected</Badge>
              ),
            ],
            ['Access token', setup.aeExpiresAt ? `${expired ? 'expired' : 'valid until'} ${when(setup.aeExpiresAt)}` : '—'],
            ['Renews itself', setup.aeRefreshable ? `yes${setup.aeRefreshExpiresAt ? `, until ${when(setup.aeRefreshExpiresAt)}` : ''}` : 'no: reconnect when it expires'],
            ['Last change', ago(setup.secretsUpdatedAt)],
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={connectAliExpress}>
            <button className={btn.primary} disabled={!setup.aeKeys}>{setup.aeConnected ? 'Reconnect AliExpress' : 'Connect AliExpress'}</button>
          </form>
          <button className={btn.secondary} disabled={pending || !setup.aeConnected} onClick={() => run(testAliExpress, 'Connected.')}>
            {pending ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Connect opens AliExpress to approve DOLGERS and brings you back here. Your app’s callback URL in the AliExpress Open Platform console must be{' '}
          <code className="break-all rounded bg-canvas px-1">{callbackUrl}</code>.
        </p>
      </Card>

      <Card title="App key and secret">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveAliExpressKeys(appKey, secret), 'Saved.');
            setSecret('');
          }}
        >
          <Field label="App key">
            <input className={input} value={appKey} onChange={(e) => setAppKey(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="App secret" hint={setup.aeKeys ? 'Saved. Leave blank to keep it.' : 'From the AliExpress Open Platform console.'}>
            <input className={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" placeholder={setup.aeKeys ? '••••••••' : ''} />
          </Field>
          <button className={btn.primary} disabled={pending}>Save</button>
        </form>
      </Card>

      <Card title="Paste tokens instead" className="lg:col-span-2">
        <p className="mb-3 text-ink-soft">Only needed if you got tokens some other way. Connect AliExpress above is easier and renews itself.</p>
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveAliExpressTokens(tok.access, tok.refresh, tok.expires), 'Tokens saved.');
            setTok({ access: '', refresh: '', expires: '' });
          }}
        >
          <Field label="Access token">
            <input className={input} type="password" autoComplete="off" value={tok.access} onChange={(e) => setTok({ ...tok, access: e.target.value })} />
          </Field>
          <Field label="Refresh token" hint="Optional">
            <input className={input} type="password" autoComplete="off" value={tok.refresh} onChange={(e) => setTok({ ...tok, refresh: e.target.value })} />
          </Field>
          <Field label="Expires at" hint="Milliseconds since 1970, optional (defaults to 24 hours)">
            <input className={input} inputMode="numeric" value={tok.expires} onChange={(e) => setTok({ ...tok, expires: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <button className={btn.secondary} disabled={pending || !tok.access}>Save tokens</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

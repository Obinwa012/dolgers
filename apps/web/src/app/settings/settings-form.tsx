'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface AeStatus {
  appKeySet: boolean;
  appSecretSet: boolean;
  connected: boolean;
  expiresAt: number | null;
}

export default function SettingsForm({ admins }: { admins: { uid: string; email: string }[] }) {
  const [status, setStatus] = useState<AeStatus | null>(null);
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  // Read the OAuth result from the URL during initial render, not in an effect.
  const [msg, setMsg] = useState(() => {
    if (typeof window === 'undefined') return '';
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected') === '1') return 'AliExpress connected — tokens saved.';
    const e = q.get('error');
    return e ? `Connection failed: ${e}` : '';
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/settings/status');
    if (r.ok) setStatus(await r.json());
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/settings/status').then(async (r) => {
      if (!ignore && r.ok) setStatus(await r.json());
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: appKey.trim(), appSecret: appSecret.trim() }),
      });
      const d = await r.json();
      setMsg(r.ok ? 'Saved. Now connect AliExpress below.' : `Error: ${d.error ?? 'save failed'}`);
      if (r.ok) { setAppKey(''); setAppSecret(''); await load(); }
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-ink text-paper px-6 py-4">
        <h1 className="font-display text-2xl">Settings</h1>
        <p className="text-sm opacity-70">AliExpress connection for the import pipeline</p>
      </header>
      <div className="max-w-xl mx-auto px-6 py-8">
        <Link href="/" className="text-sm underline underline-offset-4 mb-6 inline-block">← Back to dashboard</Link>

        <div className="bg-paper border border-line rounded-lg p-6 mb-6">
          <h2 className="font-medium mb-3">Admin users</h2>
          {admins.length === 0 ? (
            <p className="text-sm text-muted">No admins yet — the first login assigns itself.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {admins.map((a) => (
                <li key={a.uid} className="flex items-center gap-2">
                  <span>{a.email || a.uid}</span>
                  <span className="text-xs bg-success/10 text-success border border-success/30 rounded px-2 py-0.5">admin</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-paper border border-line rounded-lg p-6 mb-6">
          <h2 className="font-medium mb-3">Connection status</h2>
          {status ? (
            <ul className="text-sm space-y-1 text-muted">
              <li>App key: {status.appKeySet ? 'set' : 'missing'}</li>
              <li>App secret: {status.appSecretSet ? 'set' : 'missing'}</li>
              <li>
                Token: {status.connected
                  ? `connected${status.expiresAt ? ` (expires ${new Date(status.expiresAt).toLocaleString()})` : ''}`
                  : 'not connected'}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted">Loading…</p>
          )}
          <a
            href="/api/auth/ae/start"
            className={`inline-block mt-4 bg-ink text-paper rounded px-4 py-2 text-sm ${!status?.appKeySet || !status?.appSecretSet ? 'opacity-40 pointer-events-none' : ''}`}
          >
            Connect AliExpress
          </a>
          <p className="text-xs text-muted mt-2">Sends you to AliExpress to authorize, then back here. Tokens refresh automatically.</p>
        </div>

        <form onSubmit={save} className="bg-paper border border-line rounded-lg p-6">
          <h2 className="font-medium mb-3">App credentials</h2>
          <p className="text-xs text-muted mb-4">Stored server-side only, never shown back. From the AliExpress Open Platform console.</p>
          <label className="block text-sm mb-1" htmlFor="ak">App key</label>
          <input id="ak" className="w-full border border-line rounded px-3 py-2 mb-4 bg-paper"
            value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="e.g. 549502" />
          <label className="block text-sm mb-1" htmlFor="as">App secret</label>
          <input id="as" type="password" className="w-full border border-line rounded px-3 py-2 mb-4 bg-paper"
            value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="Paste new secret to rotate" />
          {msg && <p className="text-sm mb-4">{msg}</p>}
          <button type="submit" disabled={busy || (!appKey && !appSecret)}
            className="bg-ink text-paper rounded px-4 py-2 text-sm disabled:opacity-40">
            {busy ? 'Saving…' : 'Save credentials'}
          </button>
        </form>
      </div>
    </main>
  );
}

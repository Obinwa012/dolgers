'use client';

import { useCallback, useEffect, useState } from 'react';
import { IMPORT_CATEGORIES } from '@/lib/categories';

interface FreightOption {
  carrier: string;
  eta: string;
  cost: number | null;
  currency: string;
  tracking: boolean;
}

interface StagedProduct {
  aeProductId: string;
  title: string;
  image: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  rating: number | null;
  orders: number | null;
  freightOptions: FreightOption[];
  shipsFromUSA: boolean;
  stage1Status: string;
  stage1Note: string;
}

interface AeStatus {
  appKeySet: boolean;
  appSecretSet: boolean;
  connected: boolean;
  expiresAt: number | null;
}

export default function Dashboard() {
  const [ae, setAe] = useState<AeStatus | null>(null);
  const [keywords, setKeywords] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedProduct[]>([]);
  const [lastRun, setLastRun] = useState<{ vetted: number; passed: number; failed: number; totalCount: number | null } | null>(null);
  const [debug, setDebug] = useState<{ topKeys: string[]; dataKeys: string[]; firstProductKeys: string[]; parseVia: string; rawCount: number; parsedCount: number } | null>(null);
  const [freightDebug, setFreightDebug] = useState<{ rawKeys: string[]; rawSample: string } | null>(null);
  const [noteBreakdown, setNoteBreakdown] = useState<{ note: string; count: number }[]>([]);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [feedRaw, setFeedRaw] = useState<{ rawKeys: string[]; rawSample: string } | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [activeFeed, setActiveFeed] = useState('');
  const [feedCategory, setFeedCategory] = useState('');
  const [feedProducts, setFeedProducts] = useState<StagedProduct[]>([]);
  const [feedDebug, setFeedDebug] = useState<{ topKeys: string[]; firstProductKeys: string[]; parseVia: string; rawCount: number; parsedCount: number } | null>(null);

  const kw = (id: string, fallback: string) => keywords[id] ?? fallback;

  const loadStaging = useCallback(async (categoryId: string) => {
    try {
      const r = await fetch(`/api/stage1/staging?categoryId=${encodeURIComponent(categoryId)}`);
      if (r.ok) {
        const d = await r.json();
        setStaged(d.products ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/settings/status').then(async (r) => {
      if (!ignore && r.ok) setAe(await r.json());
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function runImport(catId: string, keyword: string, page: number) {
    setRunning(catId);
    setProgress(`Searching page ${page}…`);
    setLastRun(null);
    try {
      const r = await fetch('/api/stage1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catId, keyword, page }),
      });
      const d = await r.json();
      if (!r.ok) {
        setProgress(`Error: ${d.error ?? 'import failed'}`);
        return;
      }
      setLastRun({ vetted: d.vetted, passed: d.passed, failed: d.failed, totalCount: d.totalCount });
      setDebug(d.debug ?? null);
      setFreightDebug(d.freightDebug ?? null);
      setNoteBreakdown(d.noteBreakdown ?? []);
      setProgress(`Done — vetted ${d.vetted}, ${d.passed} ship from the USA.`);
      setActiveCat(catId);
      await loadStaging(catId);
    } catch {
      setProgress('Network error — try again.');
    } finally {
      setRunning(null);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function listFeeds() {
    setFeedLoading(true);
    setFeedError('');
    setFeedRaw(null);
    try {
      const r = await fetch('/api/ae/feeds');
      const d = await r.json();
      if (!r.ok) {
        setFeedError(d.error ?? 'Feed list failed.');
        return;
      }
      setFeeds(d.feeds ?? []);
      setFeedRaw({ rawKeys: d.rawKeys ?? [], rawSample: d.rawSample ?? '' });
      if (d.feeds?.length > 0 && !activeFeed) setActiveFeed(d.feeds[0]);
    } catch {
      setFeedError('Network error — try again.');
    } finally {
      setFeedLoading(false);
    }
  }

  async function previewFeed() {
    if (!activeFeed) return;
    setFeedLoading(true);
    setFeedError('');
    setFeedDebug(null);
    try {
      const r = await fetch('/api/ae/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedName: activeFeed, categoryId: feedCategory || undefined, page: 1 }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFeedError(d.error ?? 'Feed preview failed.');
        return;
      }
      setFeedProducts(d.products ?? []);
      setFeedDebug(d.debug ?? null);
    } catch {
      setFeedError('Network error — try again.');
    } finally {
      setFeedLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-ink text-paper px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Dolgers Import System</h1>
          <p className="text-sm opacity-70">Stage 1 — Source &amp; freight-vet: only products that truly ship from the USA</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/settings" className="text-sm underline underline-offset-4">Settings</a>
          <button onClick={logout} className="text-sm border border-paper/40 rounded px-3 py-1">Log out</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {ae && (!ae.appKeySet || !ae.appSecretSet || !ae.connected) && (
          <div className="bg-paper border border-line rounded-lg p-4 mb-6">
            <p className="text-sm">
              <strong>AliExpress is not connected.</strong> Add your app key + secret and connect
              in <a href="/settings" className="underline underline-offset-4">Settings</a> before importing.
            </p>
          </div>
        )}

        <h2 className="font-display text-xl mb-4">Categories</h2>
        <div className="bg-paper border border-line rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {IMPORT_CATEGORIES.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{c.id}</td>
                  <td className="px-4 py-3">
                    <input
                      className="border border-line rounded px-2 py-1 w-44 bg-paper"
                      value={kw(c.id, c.keyword)}
                      onChange={(e) => setKeywords((k) => ({ ...k, [c.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={running !== null}
                      onClick={() => runImport(c.id, kw(c.id, c.keyword), 1)}
                      className="bg-ink text-paper rounded px-4 py-1.5 disabled:opacity-40"
                    >
                      {running === c.id ? 'Importing…' : 'Import'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {progress && <p className="text-sm text-muted mb-4">{progress}</p>}
        {lastRun && (
          <p className="text-sm mb-6">
            Last run: <strong>{lastRun.passed}</strong> passed / {lastRun.vetted} vetted
            {lastRun.totalCount !== null && <> (search returned {lastRun.totalCount} total)</>}
          </p>
        )}
        {noteBreakdown.length > 0 && lastRun && lastRun.passed === 0 && (
          <details className="text-xs text-muted mb-6 bg-paper border border-line rounded p-3">
            <summary className="cursor-pointer">Why 0 passed — freight check breakdown</summary>
            <ul className="mt-2 space-y-1">
              {noteBreakdown.map((n, i) => (
                <li key={i}><strong>{n.count}×</strong> {n.note || '(passed)'}</li>
              ))}
            </ul>
            {freightDebug && (
              <pre className="mt-2 whitespace-pre-wrap">freight result keys: {freightDebug.rawKeys.join(', ') || '(none)'}{'\n'}{freightDebug.rawSample}</pre>
            )}
          </details>
        )}
        {debug && lastRun && lastRun.vetted === 0 && (
          <details className="text-xs text-muted mb-6 bg-paper border border-line rounded p-3">
            <summary className="cursor-pointer">No products parsed — response shape</summary>
            <pre className="mt-2 whitespace-pre-wrap">parsed via: {debug.parseVia}{'\n'}raw product entries: {debug.rawCount}, with IDs: {debug.parsedCount}{'\n'}top: {debug.topKeys.join(', ')}{'\n'}data: {debug.dataKeys.join(', ')}{'\n'}first product: {debug.firstProductKeys.join(', ') || '(none)'}</pre>
          </details>
        )}

        {activeCat && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">
              Staged — {IMPORT_CATEGORIES.find((c) => c.id === activeCat)?.name} ({staged.length})
            </h2>
            <button
              disabled={running !== null}
              onClick={() => {
                const c = IMPORT_CATEGORIES.find((x) => x.id === activeCat);
                if (c) runImport(c.id, kw(c.id, c.keyword), 2);
              }}
              className="text-sm border border-ink rounded px-3 py-1.5 disabled:opacity-40"
            >
              Import page 2
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {staged.map((p) => (
            <article key={p.aeProductId} className="bg-paper border border-line rounded-lg p-4 flex gap-4">
              {p.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-24 h-24 object-cover rounded bg-stone shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-sm font-medium leading-snug mb-1 line-clamp-2">{p.title}</h3>
                <p className="text-xs text-muted mb-2">
                  {p.currency} {p.priceMin !== null ? p.priceMin.toFixed(2) : '—'}
                  {p.priceMax !== null && p.priceMax !== p.priceMin ? ` – ${p.priceMax.toFixed(2)}` : ''}
                  {p.rating !== null && <> · ★ {p.rating.toFixed(1)}</>}
                  {p.orders !== null && <> · {p.orders} orders</>}
                </p>
                {p.shipsFromUSA ? (
                  <span className="inline-block text-xs bg-success/10 text-success border border-success/30 rounded px-2 py-0.5 mb-2">
                    Ships from USA
                  </span>
                ) : (
                  <span className="inline-block text-xs bg-danger/10 text-danger border border-danger/30 rounded px-2 py-0.5 mb-2">
                    {p.stage1Note || 'No US freight'}
                  </span>
                )}
                <ul className="text-xs text-muted space-y-0.5">
                  {p.freightOptions.slice(0, 3).map((f, i) => (
                    <li key={i}>
                      {f.carrier}{f.eta ? ` · ${f.eta}` : ''}
                      {f.cost !== null ? ` · ${f.currency} ${f.cost.toFixed(2)}` : ' · free'}
                      {f.tracking ? ' · tracked' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-xl mb-2">Dropship feeds</h2>
          <p className="text-sm text-muted mb-4">
            AliExpress-curated bestseller feeds — a second sourcing channel next to keyword search.
            List the feeds your app can see, then preview one.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={listFeeds}
              disabled={feedLoading}
              className="bg-ink text-paper rounded px-4 py-1.5 text-sm disabled:opacity-40"
            >
              {feedLoading ? 'Loading…' : 'List feeds'}
            </button>
            {feeds.length > 0 && (
              <>
                <select
                  value={activeFeed}
                  onChange={(e) => setActiveFeed(e.target.value)}
                  className="border border-line rounded px-2 py-1.5 text-sm bg-paper max-w-xs"
                >
                  {feeds.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <input
                  placeholder="Category ID (optional)"
                  value={feedCategory}
                  onChange={(e) => setFeedCategory(e.target.value)}
                  className="border border-line rounded px-2 py-1.5 text-sm w-44 bg-paper"
                />
                <button
                  onClick={previewFeed}
                  disabled={feedLoading || !activeFeed}
                  className="border border-ink rounded px-4 py-1.5 text-sm disabled:opacity-40"
                >
                  Preview feed
                </button>
              </>
            )}
          </div>
          {feedError && <p className="text-sm text-danger mb-4">{feedError}</p>}
          {feedRaw && feeds.length === 0 && (
            <details className="text-xs text-muted mb-4 bg-paper border border-line rounded p-3">
              <summary className="cursor-pointer">No feeds parsed — raw response</summary>
              <pre className="mt-2 whitespace-pre-wrap">keys: {feedRaw.rawKeys.join(', ') || '(none)'}{'\n'}{feedRaw.rawSample}</pre>
            </details>
          )}
          {feedDebug && (
            <p className="text-xs text-muted mb-4">
              Feed preview: {feedDebug.parsedCount} products parsed (raw entries {feedDebug.rawCount}, via {feedDebug.parseVia})
            </p>
          )}
          {feedProducts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {feedProducts.map((p) => (
                <article key={p.aeProductId} className="bg-paper border border-line rounded-lg p-4 flex gap-4">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="w-24 h-24 object-cover rounded bg-stone shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium leading-snug mb-1 line-clamp-2">{p.title}</h3>
                    <p className="text-xs text-muted">
                      {p.currency} {p.priceMin !== null ? p.priceMin.toFixed(2) : '—'}
                      {p.rating !== null && <> · ★ {p.rating.toFixed(1)}</>}
                      {p.orders !== null && <> · {p.orders} orders</>}
                    </p>
                    <p className="text-xs text-muted font-mono mt-1">{p.aeProductId}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

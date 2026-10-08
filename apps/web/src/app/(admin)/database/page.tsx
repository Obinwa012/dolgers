import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FieldPath } from 'firebase-admin/firestore';
import { btn, Card, Empty, input, PageHeader } from '@/components/ui.tsx';
import { when } from '@/lib/format.ts';
import { requireAdmin } from '@/server/auth.ts';
import { db } from '@/server/firebase.ts';

export const metadata = { title: 'Database' };

const PAGE = 50;
/** Collections whose document ids are credentials: never listed. */
const HIDDEN = new Set(['sessions', 'oauth_states']);
const ABOUT: Record<string, string> = {
  products: 'Your catalog: live products and ones waiting for review',
  sourcing: 'Supplier, cost, stock and shipping per product',
  vetting: 'The full decision record behind each product',
  sellers: 'AliExpress stores, ratings, strikes and blocks',
  candidates: 'The import queue and where each item stopped',
  jobs: 'Import, vet and monitor runs',
  work: 'Vetting in progress, saved after every stage',
  config: 'Settings (secrets are masked)',
  users: 'Admin accounts',
};

const SECRET_KEYS = /secret|token|apikey|api_key|password/i;

function mask(value: unknown, path: string, key = ''): unknown {
  if (path === 'config/secrets' || SECRET_KEYS.test(key)) {
    if (typeof value === 'string') return value ? `•••• saved (ends ${value.slice(-4)})` : '';
  }
  if (Array.isArray(value)) return value.map((v) => mask(v, path));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, mask(v, path, k)]));
  }
  return value;
}

function summary(d: Record<string, unknown>): string {
  const pick = ['title', 'name', 'email', 'type', 'status', 'decision', 'stage'].map((k) => d[k]).filter((v) => typeof v === 'string');
  const t = d.updatedAt ?? d.createdAt;
  return [...pick.slice(0, 3), typeof t === 'number' ? when(t) : null].filter(Boolean).join(' · ');
}

function validCollectionPath(p: string) {
  const parts = p.split('/');
  return parts.length % 2 === 1 && parts.every((s) => /^[\w\-.]{1,200}$/.test(s)) && !HIDDEN.has(parts[0]!);
}

export default async function DatabasePage({ searchParams }: { searchParams: Promise<{ c?: string; id?: string; after?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const roots = (await db().listCollections()).map((c) => c.id).filter((id) => !HIDDEN.has(id)).sort();
  const counts = await Promise.all(roots.map(async (id) => (await db().collection(id).count().get()).data().count));
  const col = sp.c && validCollectionPath(sp.c) ? sp.c : null;
  if (sp.c && !col) notFound();

  return (
    <>
      <PageHeader title="Database" sub="A read-only look inside your Firestore database. API keys and tokens are masked; sign-in sessions are never shown." />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Collections" className="space-y-1">
          {roots.map((id, i) => (
            <Link
              key={id}
              href={`/database?c=${id}`}
              aria-current={col?.split('/')[0] === id ? 'page' : undefined}
              className={`block rounded-md border px-3 py-2 ${col?.split('/')[0] === id ? 'border-denim bg-paper' : 'border-transparent hover:bg-paper'}`}
            >
              <span className="flex justify-between font-semibold">
                {id}
                <span className="tabular text-xs font-normal text-ink-soft">{counts[i]}</span>
              </span>
              {ABOUT[id] && <span className="block text-xs text-ink-soft">{ABOUT[id]}</span>}
            </Link>
          ))}
          {!roots.length && <p className="text-ink-soft">The database is empty.</p>}
        </nav>
        <div className="min-w-0">{col ? sp.id ? <DocView col={col} id={sp.id} /> : <CollectionView col={col} after={sp.after} /> : <Empty>Pick a collection.</Empty>}</div>
      </div>
    </>
  );
}

async function CollectionView({ col, after }: { col: string; after?: string }) {
  let q = db().collection(col).orderBy(FieldPath.documentId()).limit(PAGE);
  if (after) q = q.startAfter(after);
  const snap = await q.get();
  const last = snap.docs.at(-1)?.id;
  return (
    <Card title={col} action={after && <Link href={`/database?c=${col}`} className={btn.link}>First page</Link>}>
      <form action="/database" className="mb-3 flex max-w-md gap-2">
        <input type="hidden" name="c" value={col} />
        <input name="id" placeholder="Open a document by id" className={input} aria-label="Document id" />
        <button className={btn.secondary}>Open</button>
      </form>
      {snap.empty ? (
        <p className="text-ink-soft">No documents{after ? ' after this point' : ''}.</p>
      ) : (
        <ul className="divide-y divide-line">
          {snap.docs.map((d) => (
            <li key={d.id}>
              <Link href={`/database?c=${col}&id=${encodeURIComponent(d.id)}`} className="flex flex-wrap gap-x-3 py-2 hover:text-denim">
                <span className="font-mono text-xs font-semibold">{d.id}</span>
                <span className="truncate text-xs text-ink-soft">{summary(d.data())}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {snap.size === PAGE && last && (
        <Link href={`/database?c=${col}&after=${encodeURIComponent(last)}`} className={`${btn.secondary} mt-3`}>Next {PAGE} →</Link>
      )}
    </Card>
  );
}

async function DocView({ col, id }: { col: string; id: string }) {
  if (!/^[\w\-.]{1,300}$/.test(id)) notFound();
  const ref = db().collection(col).doc(id);
  const [snap, subs] = await Promise.all([ref.get(), ref.listCollections()]);
  const path = `${col}/${id}`;
  let json = snap.exists ? JSON.stringify(mask(snap.data(), path), null, 2) : '';
  const big = json.length > 300_000;
  if (big) json = `${json.slice(0, 300_000)}\n… (truncated)`;
  return (
    <Card title={<span className="font-mono normal-case">{path}</span>} action={<Link href={`/database?c=${col}`} className={btn.link}>← {col}</Link>}>
      {snap.exists ? (
        <>
          {subs.length > 0 && (
            <p className="mb-3 text-sm">
              Subcollections:{' '}
              {subs.map((s) => (
                <Link key={s.id} href={`/database?c=${encodeURIComponent(`${path}/${s.id}`)}`} className={`${btn.link} mr-2`}>{s.id}</Link>
              ))}
            </p>
          )}
          {col === 'products' && <p className="mb-3 text-sm"><Link href={`/products/${id}`} className={btn.link}>Open in Products</Link></p>}
          <pre className="max-h-[70vh] overflow-auto rounded-md border border-line bg-canvas p-3 font-mono text-xs leading-relaxed">{json}</pre>
        </>
      ) : (
        <p className="text-ink-soft">No document with that id.</p>
      )}
    </Card>
  );
}

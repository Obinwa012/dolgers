import { Nav } from '@/components/Nav.tsx';
import { requireAdmin } from '@/server/auth.ts';
import { SignOutButton } from './SignOutButton.tsx';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[220px_1fr]">
      <aside className="bg-ink px-3 py-3 text-paper lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-5">
        <div className="mb-3 flex items-center justify-between gap-3 px-3 lg:mb-6 lg:block">
          <div>
            <p className="display text-3xl tracking-wide">DOLGERS</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper/50">Men’s · US warehouses</p>
          </div>
        </div>
        <Nav />
        <div className="mt-3 hidden border-t border-paper/10 px-3 pt-4 text-xs text-paper/60 lg:mt-auto lg:block">
          <p className="truncate" title={admin.email}>{admin.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        {children}
        <div className="mt-10 border-t border-line pt-4 text-xs text-ink-soft lg:hidden">
          Signed in as {admin.email} · <SignOutButton dark />
        </div>
      </main>
    </div>
  );
}

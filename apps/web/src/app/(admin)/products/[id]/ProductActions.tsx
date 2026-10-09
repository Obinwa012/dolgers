'use client';

import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/ActionButton.tsx';
import { btn } from '@/components/ui.tsx';
import type { ProductStatus } from '@/core/firestore/model.ts';
import { productAction } from '@/server/actions/catalog.ts';
import { startJob } from '@/server/actions/jobs.ts';

export function ProductActions({ id, status, supplierUrl }: { id: string; status: ProductStatus; supplierUrl: string | null }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status === 'live' && <ActionButton action={() => productAction(id, 'pause')}>Pause</ActionButton>}
      <ActionButton action={() => productAction(id, 'reprice')} confirm="Recalculate every variant’s price from today’s cost?">
        Reprice
      </ActionButton>
      <ActionButton
        action={async () => {
          const r = await productAction(id, 'requeue');
          if (!r.ok || !r.subId) return r;
          const j = await startJob('vet', { subId: r.subId });
          return j.ok ? { ok: true as const } : j;
        }}
        then={() => router.push('/run')}
        confirm="Vet this product again from scratch? Your review ticks are cleared when it finishes."
      >
        Re-vet
      </ActionButton>
      {status !== 'retired' && (
        <ActionButton variant="danger" action={() => productAction(id, 'retire')} confirm="Retire this product? It leaves the catalog and won’t be re-imported.">
          Retire
        </ActionButton>
      )}
      {supplierUrl && (
        <a href={supplierUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
          AliExpress ↗
        </a>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/ActionButton.tsx';
import type { CandidateStatus } from '@/core/firestore/model.ts';
import { candidateAction } from '@/server/actions/catalog.ts';
import { startJob } from '@/server/actions/jobs.ts';

export function QueueActions({ subId, status }: { subId: string; status: CandidateStatus }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap justify-end gap-1.5 whitespace-nowrap">
      {status === 'new' ? (
        <ActionButton action={() => startJob('vet', { subId })} then={() => router.push('/run')}>
          Vet now
        </ActionButton>
      ) : (
        status !== 'published' && (
          <ActionButton action={() => candidateAction(subId, 'requeue')}>Requeue</ActionButton>
        )
      )}
      {(status === 'new' || status === 'vetting' || status === 'insufficient_data' || status === 'screened_out' || status === 'error') && (
        <ActionButton variant="danger" action={() => candidateAction(subId, 'skip')} confirm="Skip this item for good?">
          Skip
        </ActionButton>
      )}
    </div>
  );
}

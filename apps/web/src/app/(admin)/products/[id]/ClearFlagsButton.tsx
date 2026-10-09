'use client';

import { ActionButton } from '@/components/ActionButton.tsx';
import { clearFlags } from '@/server/actions/catalog.ts';

export function ClearFlagsButton({ id }: { id: string }) {
  return (
    <ActionButton action={() => clearFlags(id)} confirm="Clear the Monitor and customer flags? Vetting flags stay.">
      Clear new flags
    </ActionButton>
  );
}

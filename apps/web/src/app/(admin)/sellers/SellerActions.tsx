'use client';

import { ActionButton } from '@/components/ActionButton.tsx';
import { sellerAction } from '@/server/actions/catalog.ts';

export function SellerActions({ storeId, blocked }: { storeId: string; blocked: boolean }) {
  return blocked ? (
    <ActionButton action={() => sellerAction(storeId, 'unblock')} confirm="Unblock this seller? Their paused products stay paused until you approve them.">
      Unblock
    </ActionButton>
  ) : (
    <ActionButton variant="danger" action={() => sellerAction(storeId, 'block')} confirm="Block this seller? Their live and held products will be paused.">
      Block
    </ActionButton>
  );
}

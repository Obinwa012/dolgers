'use client';

import { useState } from 'react';
import { SizeGuideModal } from './SizeGuideModal';

/** Size guide button for server components (e.g. the Fit & sizing accordion). */
export function SizeGuideButton({ sizeSystem, fitNote }: { sizeSystem: string; fitNote?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline underline-offset-4"
      >
        See the size guide
      </button>
      {open && (
        <SizeGuideModal sizeSystem={sizeSystem} fitNote={fitNote} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

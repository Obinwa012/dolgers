'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Size chart data for the modal. Measurements are body measurements in inches. */
const SIZE_CHARTS: Record<string, { head: string[]; rows: string[][] }> = {
  alpha: {
    head: ['US Size', 'Chest', 'Waist', 'Neck'],
    rows: [
      ['XS', '33–35', '27–29', '14'],
      ['S', '35–37', '29–31', '14.5'],
      ['M', '38–40', '32–34', '15–15.5'],
      ['L', '41–43', '35–37', '16–16.5'],
      ['XL', '44–46', '38–40', '17–17.5'],
      ['2XL', '47–49', '41–43', '18–18.5'],
      ['3XL', '50–52', '44–46', '19–19.5'],
    ],
  },
};

export function SizeGuideModal({
  sizeSystem,
  fitNote,
  onClose,
}: {
  sizeSystem: string;
  fitNote?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const chart = SIZE_CHARTS[sizeSystem] ?? SIZE_CHARTS.alpha;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Size guide"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="display text-2xl">Size guide</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-muted"
            aria-label="Close size guide"
          >
            <X size={20} />
          </button>
        </div>

        {fitNote && (
          <p className="mt-4 text-sm leading-relaxed text-muted">{fitNote}</p>
        )}

        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Size measurements in inches</caption>
          <thead>
            <tr className="border-b border-line">
              {chart.head.map((h) => (
                <th key={h} className="py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row) => (
              <tr key={row[0]} className="border-b border-line/50">
                {row.map((cell, i) => (
                  <td key={i} className={`py-2 ${i === 0 ? 'font-medium' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-muted">
          Measure your chest around the fullest part, under your arms, with the tape level.
          Measurements are body measurements in inches.
        </p>
      </div>
    </div>
  );
}

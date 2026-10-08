import type { Product } from '@/lib/catalog';

const CONFIDENCE: Record<string, string> = {
  high: 'Confirmed by the seller’s chart and US buyers',
  medium: 'Seller’s chart plus a few US buyer reports',
  low: 'Seller’s chart and US sizing only',
};

export function SizeGuide({ chart }: { chart: NonNullable<Product['sizeChart']> }) {
  const garmentKeys = [...new Set(chart.rows.flatMap((r) => Object.keys(r.garment)))];
  const bodyKeys = [...new Set(chart.rows.flatMap((r) => r.fitsBody.map((b) => b.measure)))];
  return (
    <section aria-labelledby="size-guide" className="scroll-mt-8" id="size">
      <h2 id="size-guide" className="display text-4xl">Size guide</h2>
      <p className="mt-2 text-ink-soft">{chart.fitType}. Measurements in inches.</p>
      {chart.fitNotes.length > 0 && (
        <ul className="mt-4 space-y-1">
          {chart.fitNotes.map((n) => (
            <li key={n} className="border-l-4 border-denim pl-3">{n}</li>
          ))}
        </ul>
      )}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">Body measurements each size fits, and the garment’s own measurements</caption>
          <thead>
            <tr className="border-b-2 border-ink">
              <th scope="col" className="py-2 pr-4">Size</th>
              {bodyKeys.map((k) => (
                <th key={k} scope="col" className="py-2 pr-4">Fits {k}</th>
              ))}
              {garmentKeys.map((k) => (
                <th key={k} scope="col" className="py-2 pr-4 font-normal text-ink-soft">Garment {k}</th>
              ))}
              <th scope="col" className="py-2 font-normal text-ink-soft">Based on</th>
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((r) => (
              <tr key={r.size} className="border-b border-mist">
                <th scope="row" className="py-2.5 pr-4 font-semibold">{r.size}</th>
                {bodyKeys.map((k) => {
                  const b = r.fitsBody.find((x) => x.measure === k);
                  return <td key={k} className="py-2.5 pr-4">{b ? (b.min === b.max ? `${b.max}"` : `${b.min}–${b.max}"`) : '–'}</td>;
                })}
                {garmentKeys.map((k) => (
                  <td key={k} className="py-2.5 pr-4 text-ink-soft">{r.garment[k] !== undefined ? `${r.garment[k]}"` : '–'}</td>
                ))}
                <td className="py-2.5 text-sm text-ink-soft">{CONFIDENCE[r.confidence]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

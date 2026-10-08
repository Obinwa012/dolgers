/**
 * The "before you buy" label: everything the vetting found that a shopper should know, set like a
 * sewn-in garment care label. Lines come straight from the product record; nothing is invented here.
 */
export function CareTag({ title, lines }: { title: string; lines: { term: string; detail: string }[] }) {
  return (
    <section aria-label={title} className="care-tag">
      <h2 className="display text-[1.65rem] text-denim-deep">{title}</h2>
      <dl className="mt-4 space-y-3 text-[0.95rem]">
        {lines.map((l) => (
          <div key={`${l.term}-${l.detail}`} className="grid grid-cols-[5.75rem_1fr] gap-3 sm:grid-cols-[7.5rem_1fr]">
            <dt className="font-semibold text-ink">{l.term}</dt>
            <dd className="text-ink-soft">{l.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Renders vendor-supplied plain text, one <p> per blank-line-separated paragraph. Never HTML. */
export function Paragraphs({ text, className = '' }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className={`whitespace-pre-line ${className}`}>{p}</p>
      ))}
    </>
  );
}

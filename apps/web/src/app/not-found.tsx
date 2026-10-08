import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="display text-5xl">Not found</p>
        <p className="mt-3 text-ink-soft">That page or record doesn’t exist.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-denim underline">Back to the dashboard</Link>
      </div>
    </main>
  );
}

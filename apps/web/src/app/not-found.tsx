import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="display text-6xl text-denim-deep">This page isn’t here</h1>
      <p className="mt-4 max-w-lg text-ink-soft">
        The product may have sold out or been paused while we re-check it. Browse what’s available instead.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/men" className="rounded-md bg-denim px-5 py-3 font-semibold text-paper">Shop men</Link>
        <Link href="/women" className="rounded-md border border-denim px-5 py-3 font-semibold text-denim">Shop women</Link>
      </div>
    </section>
  );
}

'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6">
      <div className="max-w-lg rounded-lg border border-line bg-paper p-6">
        <p className="display text-3xl">Something went wrong</p>
        <p className="mt-3 text-ink-soft">{error.message || 'The page could not load.'}</p>
        {error.digest && <p className="mt-2 text-xs text-ink-soft">Reference: {error.digest}</p>}
        <button onClick={reset} className="mt-5 rounded-md bg-ink px-4 py-2 font-semibold text-paper">Try again</button>
      </div>
    </main>
  );
}

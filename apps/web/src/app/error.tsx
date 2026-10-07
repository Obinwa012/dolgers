'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center bg-cream px-4">
      <h1 className="font-display text-4xl mb-4">Something went wrong</h1>
      <p className="text-muted mb-8">Please try again.</p>
      <button type="button" onClick={reset} className="bg-ink text-paper rounded px-6 py-2">
        Try again
      </button>
    </main>
  );
}

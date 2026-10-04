'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="display text-4xl">Something went wrong</h1>
      <p className="mt-4 max-w-md text-muted">Please try again. If it keeps happening, contact us and we will sort it out.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">Try again</button>
    </main>
  );
}

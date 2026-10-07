import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center bg-cream px-4">
      <h1 className="font-display text-5xl mb-4">Not found</h1>
      <p className="text-muted mb-8">That page does not exist.</p>
      <Link href="/" className="bg-ink text-paper rounded px-6 py-2">
        Back to dashboard
      </Link>
    </main>
  );
}

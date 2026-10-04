import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Logo />
      <h1 className="display mt-12 text-5xl">Not found</h1>
      <p className="mt-4 max-w-md text-muted">That page has moved, sold out or never existed.</p>
      <Link href="/" className="btn btn-primary mt-8">Back to the shop</Link>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="font-display text-7xl text-brand-700">404</p>
      <h1 className="mt-2 font-display text-3xl uppercase">Page not found</h1>
      <Link href="/" className="btn btn-brand mt-8">Back to home</Link>
    </div>
  );
}

import Link from "next/link";

/** Minimal light utility topbar: contact info left, account links right. */
export default function AnnouncementBar() {
  return (
    <div className="border-b border-slate-100 bg-white text-slate-500" aria-label="Store information">
      <div className="container-x flex h-9 items-center justify-between text-[11px] font-medium">
        <p className="flex items-center gap-4">
          <span className="hidden sm:inline">Call us: (555) 010-4477</span>
          <span className="hidden md:inline">sales@dolgers.com</span>
          <span className="hidden lg:inline">Mon–Sat 7AM–7PM CT</span>
          <span className="sm:hidden">All orders ship from US warehouses</span>
        </p>
        <nav className="flex items-center gap-4 uppercase tracking-wide" aria-label="Utility">
          <Link href="/account" className="transition hover:text-ink">Track Order</Link>
          <Link href="/sell" className="transition hover:text-ink">Become a Seller</Link>
          <Link href="/account" className="transition hover:text-ink">My Account</Link>
        </nav>
      </div>
    </div>
  );
}

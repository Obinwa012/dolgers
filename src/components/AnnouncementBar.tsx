import Link from "next/link";

/** Dark utility topbar: contact info left, account links right. */
export default function AnnouncementBar() {
  return (
    <div className="bg-ink text-white" aria-label="Store information">
      <div className="container-x flex h-9 items-center justify-between text-xs font-semibold">
        <p className="flex items-center gap-4 text-white/70">
          <span className="hidden sm:inline">Call us: (555) 010-4477</span>
          <span className="hidden md:inline">sales@dolgers.com</span>
          <span className="hidden lg:inline">Mon–Sat 7AM–7PM CT</span>
          <span className="sm:hidden">All orders ship from US warehouses</span>
        </p>
        <nav className="flex items-center gap-4 uppercase tracking-wide" aria-label="Utility">
          <Link href="/account" className="text-white/70 hover:text-accent">Track Order</Link>
          <Link href="/sell" className="text-white/70 hover:text-accent">Become a Seller</Link>
          <Link href="/account" className="text-white/70 hover:text-accent">My Account</Link>
        </nav>
      </div>
    </div>
  );
}

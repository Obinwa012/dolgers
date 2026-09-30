import Link from "next/link";
import Logo from "./Logo";
import Newsletter from "./Newsletter";

const cols = [
  {
    title: "Shop",
    links: [
      ["Power Tools", "/collections/power-tools"],
      ["Hand Tools", "/collections/hand-tools"],
      ["Air Tools", "/collections/air-tools"],
      ["Safety Equipment", "/collections/safety"],
      ["Abrasives", "/collections/abrasives"],
      ["Clearance", "/collections/all?clearance=1"],
    ],
  },
  {
    title: "Information",
    links: [
      ["About Dolgers", "/pages/about"],
      ["Shipping & Returns", "/pages/shipping"],
      ["Become a Seller", "/sell"],
      ["Pro Desk", "/pages/trade"],
      ["Careers", "/pages/careers"],
      ["Privacy Policy", "/pages/privacy"],
    ],
  },
  {
    title: "My Account",
    links: [
      ["Sign In", "/login"],
      ["Order Status", "/account"],
      ["Wishlist", "/wishlist"],
      ["Trade Accounts", "/pages/trade"],
      ["Seller Dashboard", "/seller"],
    ],
  },
];

/** Equipo home-4 footer: newsletter band, link columns, bottom bar. */
export default function Footer() {
  return (
    <footer className="mt-14 bg-ink text-[#b9b9be]">
      <div className="container-x">
        {/* Newsletter band */}
        <div className="flex flex-col gap-5 border-b border-[#333338] py-[30px] md:flex-row md:items-center md:gap-5">
          <div className="md:max-w-xs">
            <h3 className="font-display text-xl font-black uppercase text-white">
              Get <span className="text-accent">Pro Deals</span> First
            </h3>
            <p className="mt-1 text-[13px]">Join 40,000+ tradespeople getting weekly drops.</p>
          </div>
          <div className="md:ml-auto md:w-full md:max-w-[440px]">
            <Newsletter variant="bar" />
          </div>
        </div>

        {/* Columns */}
        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Logo tone="light" className="mb-3" />
            <p className="mb-4 text-[13px]">
              Pro-grade tools and hardware from independent American sellers, shipped fast from US warehouses.
            </p>
            <h4 className="mb-2 font-display text-sm font-extrabold uppercase tracking-wider text-white">Sell on Dolgers?</h4>
            <p className="text-[13px]">
              Open your storefront to millions of buyers.<br />
              <Link href="/sell" className="font-bold text-accent hover:underline">Become a seller →</Link>
            </p>
            <h4 className="mb-2 mt-[18px] font-display text-sm font-extrabold uppercase tracking-wider text-white">Need Help?</h4>
            <p className="font-display text-lg font-extrabold text-accent">(555) 010-4477</p>
            <p className="mt-1.5 text-[13px]">sales@dolgers.com<br />Mon–Sat 7AM–7PM CT</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-4 font-display text-sm font-extrabold uppercase tracking-wider text-white">{c.title}</h4>
              <ul>
                {c.links.map(([label, href]) => (
                  <li key={label} className="mb-2.5 text-[13px]">
                    <Link href={href} className="hover:text-accent">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-[#333338] py-[18px] text-xs text-[#77787e] sm:flex-row">
          <p>© {new Date().getFullYear()} Dolgers LLC. All rights reserved.</p>
          <p>
            <Link href="/pages/terms" className="ml-[18px] hover:text-accent">Terms</Link>
            <Link href="/pages/privacy" className="ml-[18px] hover:text-accent">Privacy</Link>
            <Link href="/pages/accessibility" className="ml-[18px] hover:text-accent">Accessibility</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

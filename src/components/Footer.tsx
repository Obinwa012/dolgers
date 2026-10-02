import Link from "next/link";
import Logo from "./Logo";
import Newsletter from "./Newsletter";

const cols = [
  {
    title: "Shop",
    links: [
      ["Dresses", "/collections/dresses"],
      ["Tops & Blouses", "/collections/tops"],
      ["Knitwear", "/collections/knitwear"],
      ["Coats & Jackets", "/collections/outerwear"],
      ["Jeans & Trousers", "/collections/bottoms"],
      ["Clearance", "/collections/all?clearance=1"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Shipping & Returns", "/pages/shipping"],
      ["Find Your Fit", "/blog/finding-your-fit-petite-regular-tall-plus"],
      ["Contact Us", "/pages/contact"],
      ["Order Status", "/account"],
      ["Privacy Policy", "/pages/privacy"],
    ],
  },
  {
    title: "Sell with us",
    links: [
      ["Open a Boutique", "/sell"],
      ["Seller Dashboard", "/seller"],
      ["Our Boutiques", "/sellers"],
      ["Brands", "/brands"],
    ],
  },
  {
    title: "My account",
    links: [
      ["Sign In", "/login"],
      ["Register", "/register"],
      ["Wishlist", "/wishlist"],
      ["Cart", "/cart"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#eee] bg-white text-[#666]">
      <div className="container-x">
        <div className="flex flex-col gap-4 border-b border-[#f0f0f0] py-6 md:flex-row md:items-center md:gap-8">
          <div className="md:max-w-xs">
            <h3 className="text-lg font-black text-ink">Be first to see <span className="text-accent">new drops</span></h3>
            <p className="mt-0.5 text-[13px]">New drops and member-only deals, once a week.</p>
          </div>
          <div className="md:ml-auto md:w-full md:max-w-[440px]">
            <Newsletter variant="bar" />
          </div>
        </div>

        <div className="grid gap-8 py-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo className="mb-3" />
            <p className="text-[13px] leading-relaxed">
              Women&apos;s fashion from Dolgers and independent boutiques, shipped fast from US warehouses.
            </p>
            <p className="mt-4 text-xs text-[#999]">Customer care</p>
            <p className="text-lg font-black text-accent">(555) 010-4477</p>
            <p className="text-[13px]">hello@dolgers.example · Mon–Sat 7AM–7PM CT</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-3 text-sm font-bold text-ink">{c.title}</h4>
              <ul>
                {c.links.map(([label, href]) => (
                  <li key={label} className="mb-2 text-[13px]">
                    <Link href={href} className="hover:text-accent">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-[#f0f0f0] py-4 text-xs text-[#999] sm:flex-row">
          <p>© {new Date().getFullYear()} Dolgers LLC. All rights reserved.</p>
          <p>
            <Link href="/pages/terms" className="ml-4 hover:text-accent">Terms</Link>
            <Link href="/pages/privacy" className="ml-4 hover:text-accent">Privacy</Link>
            <Link href="/pages/accessibility" className="ml-4 hover:text-accent">Accessibility</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

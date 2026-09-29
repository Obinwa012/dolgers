import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import Logo from "./Logo";
import Newsletter from "./Newsletter";

const cols = [
  {
    title: "Shop",
    links: [
      ["New In", "/collections/all?sort=new"],
      ["Power Tools", "/collections/power-tools"],
      ["Hand Tools", "/collections/hand-tools"],
      ["Storage", "/collections/storage"],
      ["Deals", "/collections/all?sale=1"],
      ["Clearance", "/collections/all?clearance=1"],
      ["Brands", "/brands"],
      ["Marketplace Sellers", "/sellers"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About Torqline", "/pages/about"],
      ["Workshop Blog", "/blog"],
      ["Trade Accounts", "/pages/trade"],
      ["Sell on Torqline", "/sell"],
      ["Seller Dashboard", "/seller"],
      ["Careers", "/pages/careers"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Shipping & Returns", "/pages/shipping"],
      ["Warranty", "/pages/warranty"],
      ["Order Status", "/account"],
      ["Contact Us", "/pages/contact"],
      ["Privacy Policy", "/pages/privacy"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto bg-brand-700 text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr]">
        <div className="space-y-4 text-sm">
          <Logo />
          <p className="flex gap-3 text-white/85">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            120 Foundry Lane, Unit 4<br />Austin, TX 78702
          </p>
          <p className="flex items-center gap-3 text-white/85">
            <Phone className="h-4 w-4" /> (555) 010-4477
          </p>
          <p className="flex items-center gap-3 text-white/85">
            <Mail className="h-4 w-4" /> hello@torqline.example
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-4 font-display text-lg">{c.title}</h3>
            <ul className="space-y-2.5 text-sm text-white/85">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-accent">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="mb-4 font-display text-lg">Get the deals first</h3>
          <p className="mb-4 text-sm text-white/85">
            Weekly tool drops, member pricing and project guides. No spam, unsubscribe anytime.
          </p>
          <Newsletter tone="dark" />
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} Torqline Supply Co. Demo storefront.</p>
          <p>Built with Next.js, Tailwind CSS and Firebase</p>
        </div>
      </div>
    </footer>
  );
}

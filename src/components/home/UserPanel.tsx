"use client";

import { Heart, Package, RotateCcw, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";

const NOTICES: [label: string, href: string][] = [
  ["Free shipping on orders over $99", "/pages/shipping"],
  ["30-day returns, no fuss", "/pages/shipping"],
  ["New: Autumn Edit is live", "/collections/all?sort=new"],
  ["Open your boutique on Dolgers", "/sell"],
];

/** Right-hand account card: greeting, sign-in buttons, shortcuts and notices. */
export default function UserPanel({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { count, wishlist } = useShop();
  const shortcuts = [
    { href: "/account", label: "Orders", Icon: Package },
    { href: "/wishlist", label: "Wishlist", Icon: Heart, n: wishlist.length },
    { href: "/cart", label: "Cart", Icon: ShoppingCart, n: count },
    { href: "/pages/shipping", label: "Returns", Icon: RotateCcw },
  ];
  return (
    <aside className={`flex flex-col rounded-xl bg-white p-4 ${className}`} aria-label="Your account">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-100 text-accent">
          <User className="h-6 w-6" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-xs text-[#999]">Hi, welcome to Dolgers</p>
          <p className="truncate text-sm font-bold text-ink">{user ? (user.displayName ?? user.email ?? "Member") : "Sign in for deals"}</p>
        </div>
      </div>
      {user ? (
        <Link href="/account" className="btn btn-brand mt-3.5 w-full py-2! text-sm">My orders</Link>
      ) : (
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Link href="/login" className="btn btn-brand px-0! py-2! text-sm">Sign in</Link>
          <Link href="/register" className="btn btn-outline px-0! py-2! text-sm">Register</Link>
        </div>
      )}
      <ul className="mt-4 grid grid-cols-4 gap-1 border-y border-[#f2f2f2] py-3 text-center">
        {shortcuts.map(({ href, label, Icon, n }) => (
          <li key={label}>
            <Link href={href} className="group flex flex-col items-center gap-1 text-[11px] text-[#666] hover:text-accent">
              <span className="relative">
                <Icon className="h-[22px] w-[22px] text-[#555] group-hover:text-accent" strokeWidth={1.6} />
                {!!n && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{n}</span>}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex-1">
        <p className="mb-1.5 text-xs font-bold text-accent">Announcements</p>
        <ul className="space-y-1.5">
          {NOTICES.map(([label, href]) => (
            <li key={label}>
              <Link href={href} className="block truncate text-[13px] text-[#555] hover:text-accent">
                <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-accent align-middle" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

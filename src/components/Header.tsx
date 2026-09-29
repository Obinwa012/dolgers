"use client";

import { ChevronDown, Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import type { Category } from "@/lib/types";
import Logo from "./Logo";
import { ICONS } from "./ToolArt";

const nav = [
  { href: "/collections/all?sort=new", label: "New In", badge: "New" },
  { href: "/collections/power-tools", label: "Power Tools" },
  { href: "/collections/hand-tools", label: "Hand Tools" },
  { href: "/collections/lawn-garden", label: "Garden" },
  { href: "/collections/all?sale=1", label: "Deals", badge: "Sale", badgeClass: "bg-sale" },
  { href: "/brands", label: "Brands" },
  { href: "/blog", label: "Workshop Blog" },
];

export default function Header({ categories }: { categories: Category[] }) {
  const { user } = useAuth();
  const { count, wishlist, setDrawerOpen } = useShop();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [catsOpen, setCatsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mobile menu: close on Escape and stop the page scrolling underneath it.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/collections/all${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
    setMobileOpen(false);
  };

  const searchBox = () => (
    <form onSubmit={submit} role="search" className="flex w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search drills, saws, storage…"
        aria-label="Search products"
        className="h-10 w-full rounded-l-md bg-white px-4 text-sm text-ink outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="grid h-10 w-12 place-items-center rounded-r-md bg-brand-500 text-white hover:bg-brand-600"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <div className="bg-brand-700">
        <div className="container-x flex h-16 items-center gap-4 md:h-[72px]">
          <button
            className="text-white lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <Logo />
          <div className="mx-auto hidden max-w-xl flex-1 md:block">
            {searchBox()}
          </div>
          <nav className="ml-auto flex items-center gap-5 text-white md:ml-0" aria-label="Account">
            <Link
              href={user ? "/account" : "/login"}
              className="hidden items-center gap-2 font-display text-sm uppercase hover:text-accent sm:flex"
            >
              <User className="h-5 w-5" />
              {user ? "Account" : "Log in"}
            </Link>
            <Link
              href="/wishlist"
              className="relative flex items-center gap-2 font-display text-sm uppercase hover:text-accent"
              aria-label={`Wishlist, ${wishlist.length} items`}
            >
              <Heart className="h-5 w-5" />
              <span className="hidden lg:inline">Wishlist</span>
              {wishlist.length > 0 && <Dot n={wishlist.length} />}
            </Link>
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex items-center gap-2 font-display text-sm uppercase hover:text-accent"
              aria-label={`Cart, ${count} items`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden lg:inline">Cart</span>
              {count > 0 && <Dot n={count} />}
            </button>
          </nav>
        </div>
        <div className="container-x pb-3 md:hidden">
          {searchBox()}
        </div>
      </div>

      {/* Secondary nav */}
      <div className="hidden border-b border-slate-200 bg-white lg:block">
        <div className="container-x flex h-14 items-center gap-8">
          <div className="relative" onMouseLeave={() => setCatsOpen(false)}>
            <button
              onClick={() => setCatsOpen((v) => !v)}
              onMouseEnter={() => setCatsOpen(true)}
              aria-expanded={catsOpen}
              className="flex h-14 items-center gap-3 font-display text-sm uppercase"
            >
              <Menu className="h-5 w-5" /> Shop all categories
              <ChevronDown className="h-4 w-4" />
            </button>
            {catsOpen && (
              <div className="absolute left-0 top-full w-72 rounded-b-md border border-slate-200 bg-white py-2 shadow-xl">
                {categories.map((c) => {
                  const Icon = ICONS[c.icon];
                  return (
                    <Link
                      key={c.slug}
                      href={`/collections/${c.slug}`}
                      onClick={() => setCatsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Icon className="h-4 w-4" style={{ color: c.tint }} />
                      {c.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <nav className="flex items-center gap-7" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="relative font-display text-sm uppercase hover:text-brand-600"
              >
                {n.badge && (
                  <span
                    className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded px-1.5 text-[10px] leading-4 text-white ${n.badgeClass ?? "bg-brand-500"}`}
                  >
                    {n.badge}
                  </span>
                )}
                {n.label}
              </Link>
            ))}
          </nav>
          <p className="ml-auto text-xs text-muted">Pro support, 7 days: (555) 010-4477</p>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white">
            <div className="flex items-center justify-between bg-brand-700 p-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="divide-y divide-slate-100">
              {nav.map((n) => (
                <Link
                  key={n.label}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3.5 font-display uppercase"
                >
                  {n.label}
                </Link>
              ))}
              <p className="px-5 pb-1 pt-5 text-xs font-semibold uppercase text-muted">Categories</p>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3 text-sm"
                >
                  {c.name}
                </Link>
              ))}
              <Link
                href={user ? "/account" : "/login"}
                onClick={() => setMobileOpen(false)}
                className="block px-5 py-4 font-display uppercase text-brand-700"
              >
                {user ? "My account" : "Log in / Register"}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Dot({ n }: { n: number }) {
  return (
    <span className="absolute -right-2.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink lg:-left-2.5 lg:right-auto">
      {n}
    </span>
  );
}

"use client";

import { ChevronDown, Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import type { Category } from "@/lib/types";
import Logo from "./Logo";
import MegaMenu from "./MegaMenu";

const nav = [
  { href: "/", label: "Home" },
  { href: "/brands", label: "Shop by Brand", badge: "New" },
  { href: "/collections/all?sale=1", label: "Deals" },
  { href: "/collections/all", label: "Shop" },
  { href: "/sellers", label: "Sellers" },
  { href: "/blog", label: "Blog" },
];

export default function Header({ categories }: { categories: Category[] }) {
  const { user } = useAuth();
  const { count, wishlist, setDrawerOpen } = useShop();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [catsOpen, setCatsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    if (!catsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCatsOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [catsOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (cat !== "all") params.set("cat", cat);
    const qs = params.toString();
    router.push(`/collections/all${qs ? `?${qs}` : ""}`);
    setMobileOpen(false);
  };

  const searchBox = (id: string) => (
    <form onSubmit={submit} role="search" className="flex h-[46px] w-full overflow-hidden rounded border-2 border-ink bg-white">
      <label htmlFor={`${id}-cat`} className="sr-only">Category</label>
      <select
        id={`${id}-cat`}
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        className="hidden max-w-[150px] border-r border-slate-200 bg-surface px-3 text-xs font-semibold text-muted outline-none sm:block"
      >
        <option value="all">All Categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>{c.name}</option>
        ))}
      </select>
      <input
        id={`${id}-q`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What can we help you find today?"
        aria-label="Search products"
        className="min-w-0 flex-1 px-4 text-sm text-ink outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-accent px-6 text-[13px] font-extrabold uppercase tracking-wider text-white hover:bg-[#c97a00]"
      >
        <Search className="h-4 w-4 sm:hidden" aria-label="Search" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Main bar */}
      <div className="border-b border-slate-200">
        <div className="container-x flex items-center gap-4 py-4 md:gap-7">
          <button className="text-ink lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Logo />
          <div className="hidden max-w-[640px] flex-1 md:block">{searchBox("desk")}</div>
          <div className="ml-auto flex items-center gap-5 md:ml-0">
            <Link href="/wishlist" className="hidden flex-col items-center gap-1 text-[10px] font-bold uppercase text-muted hover:text-accent sm:flex" aria-label={`Wishlist, ${wishlist.length} items`}>
              <span className="relative">
                <Heart className="h-[26px] w-[26px]" />
                {wishlist.length > 0 && <Count n={wishlist.length} />}
              </span>
              Wishlist
            </Link>
            <Link href={user ? "/account" : "/login"} className="hidden flex-col items-center gap-1 text-[10px] font-bold uppercase text-muted hover:text-accent sm:flex">
              <User className="h-[26px] w-[26px]" />
              {user ? "Account" : "Account"}
            </Link>
            <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase text-muted hover:text-accent" aria-label={`Cart, ${count} items`}>
              <span className="relative">
                <ShoppingCart className="h-[26px] w-[26px]" />
                {count > 0 && <Count n={count} />}
              </span>
              Cart
            </button>
          </div>
        </div>
        <div className="container-x pb-3 md:hidden">{searchBox("mob")}</div>
      </div>

      {/* Nav */}
      <nav className="hidden bg-ink text-white lg:block" aria-label="Main">
        <div className="container-x flex items-stretch">
          <div onMouseLeave={() => setCatsOpen(false)} className="relative">
            <button
              onClick={() => setCatsOpen((v) => !v)}
              onMouseEnter={() => setCatsOpen(true)}
              aria-expanded={catsOpen}
              aria-controls="mega-menu"
              className="flex h-full items-center gap-2.5 bg-accent px-6 text-sm font-extrabold uppercase tracking-wide text-white"
            >
              <Menu className="h-[18px] w-[18px]" /> Shop by Category
              <ChevronDown className={`h-4 w-4 transition ${catsOpen ? "rotate-180" : ""}`} />
            </button>
            {catsOpen && <MegaMenu id="mega-menu" categories={categories} onNavigate={() => setCatsOpen(false)} />}
          </div>
          <ul className="flex items-center">
            {nav.map((n) => (
              <li key={n.label}>
                <Link href={n.href} className="block px-5 py-[15px] text-[13px] font-bold uppercase tracking-wider text-white/90 hover:text-accent">
                  {n.label}
                  {n.badge && (
                    <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 align-middle text-[9px] font-extrabold text-white">
                      {n.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center">
            <Link
              href="/pages/trade"
              className="rounded border-2 border-accent px-6 py-2 text-[13px] font-extrabold uppercase tracking-wider text-accent hover:bg-accent hover:text-white"
            >
              Pro Desk
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white">
            <div className="flex items-center justify-between bg-ink p-4">
              <Logo tone="light" />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="divide-y divide-slate-100">
              {nav.map((n) => (
                <Link key={n.label} href={n.href} onClick={() => setMobileOpen(false)} className="block px-5 py-3.5 font-display font-bold uppercase">
                  {n.label}
                </Link>
              ))}
              <p className="px-5 pb-1 pt-5 text-xs font-semibold uppercase text-muted">Categories</p>
              {categories.map((c) => (
                <Link key={c.slug} href={`/collections/${c.slug}`} onClick={() => setMobileOpen(false)} className="block px-5 py-3 text-sm">
                  {c.name}
                </Link>
              ))}
              <Link href={user ? "/account" : "/login"} onClick={() => setMobileOpen(false)} className="block px-5 py-4 font-display font-bold uppercase text-accent">
                {user ? "My account" : "Log in / Register"}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-white">
      {n}
    </span>
  );
}

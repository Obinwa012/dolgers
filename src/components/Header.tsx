"use client";

import { ChevronDown, Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import type { Brand, Category } from "@/lib/types";
import Logo from "./Logo";
import MegaMenu from "./MegaMenu";
import BrandMegaMenu from "./BrandMegaMenu";

const nav = [
  { href: "/collections/all?sale=1", label: "Deals" },
  { href: "/collections/all", label: "Shop" },
  { href: "/sellers", label: "Sellers" },
  { href: "/blog", label: "Blog" },
];

type MenuKind = "cats" | "brands" | null;

export default function Header({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const { user } = useAuth();
  const { count, wishlist, setDrawerOpen } = useShop();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openMenu, setOpenMenu] = useState<MenuKind>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

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
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openMenu]);

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const open = (kind: MenuKind) => {
    cancelClose();
    setOpenMenu(kind);
  };

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
    <form onSubmit={submit} role="search" className="flex h-11 w-full overflow-hidden rounded border border-slate-300 bg-white focus-within:border-ink">
      <label htmlFor={`${id}-cat`} className="sr-only">Category</label>
      <select
        id={`${id}-cat`}
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        className="hidden max-w-[150px] border-r border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 outline-none sm:block"
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
        placeholder="Search tools, brands, SKUs…"
        aria-label="Search products"
        className="min-w-0 flex-1 px-4 text-sm text-ink outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        aria-label="Search"
        className="grid w-14 shrink-0 place-items-center bg-accent text-white transition hover:bg-[#c97a00]"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Main bar */}
      <div className="container-x flex items-center gap-4 py-4 md:gap-8">
        <button className="text-slate-600 lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <Logo />
        <div className="hidden max-w-[620px] flex-1 md:block">{searchBox("desk")}</div>
        <div className="ml-auto flex items-center gap-6 md:ml-0">
          <Link href="/wishlist" className="hidden flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-ink sm:flex" aria-label={`Wishlist, ${wishlist.length} items`}>
            <span className="relative">
              <Heart className="h-6 w-6" strokeWidth={1.75} />
              {wishlist.length > 0 && <Count n={wishlist.length} />}
            </span>
            Wishlist
          </Link>
          <Link href={user ? "/account" : "/login"} className="hidden flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-ink sm:flex">
            <User className="h-6 w-6" strokeWidth={1.75} />
            Account
          </Link>
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-ink" aria-label={`Cart, ${count} items`}>
            <span className="relative">
              <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />
              {count > 0 && <Count n={count} />}
            </span>
            Cart
          </button>
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">{searchBox("mob")}</div>

      {/* Minimalist nav */}
      <nav className="relative hidden border-y border-slate-200 bg-white lg:block" aria-label="Main" onMouseLeave={scheduleClose}>
        <div className="container-x flex items-center">
          <div onMouseEnter={() => open("cats")}>
            <button
              onClick={() => setOpenMenu(openMenu === "cats" ? null : "cats")}
              aria-expanded={openMenu === "cats"}
              className={`flex items-center gap-2 border-b-2 py-3.5 pr-6 text-[13px] font-bold uppercase tracking-wider transition ${
                openMenu === "cats" ? "border-accent text-ink" : "border-transparent text-ink hover:border-slate-300"
              }`}
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
              Shop by Category
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${openMenu === "cats" ? "rotate-180" : ""}`} />
            </button>
          </div>
          <ul className="flex items-center">
            <li onMouseEnter={() => open("brands")}>
              <Link
                href="/brands"
                onClick={() => setOpenMenu(null)}
                className={`flex items-center border-b-2 px-5 py-3.5 text-[13px] font-semibold uppercase tracking-wider transition ${
                  openMenu === "brands" ? "border-accent text-ink" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-ink"
                }`}
              >
                Shop by Brand
                <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 align-middle text-[9px] font-extrabold uppercase text-white">
                  New
                </span>
              </Link>
            </li>
            {nav.map((n) => (
              <li key={n.label} onMouseEnter={() => open(null)}>
                <Link
                  href={n.href}
                  className="block border-b-2 border-transparent px-5 py-3.5 text-[13px] font-semibold uppercase tracking-wider text-slate-600 transition hover:border-slate-300 hover:text-ink"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center" onMouseEnter={() => open(null)}>
            <Link
              href="/pages/trade"
              className="rounded border border-accent/70 px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-accent transition hover:bg-accent hover:text-white"
            >
              Pro Desk
            </Link>
          </div>
        </div>
        {openMenu === "cats" && (
          <div onMouseEnter={cancelClose}>
            <MegaMenu categories={categories} onNavigate={() => setOpenMenu(null)} />
          </div>
        )}
        {openMenu === "brands" && (
          <div onMouseEnter={cancelClose}>
            <BrandMegaMenu brands={brands} onNavigate={() => setOpenMenu(null)} />
          </div>
        )}
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
              <Link href="/brands" onClick={() => setMobileOpen(false)} className="block px-5 py-3.5 font-display font-bold uppercase">
                Shop by Brand
              </Link>
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

"use client";

import { ChevronDown, Heart, Menu, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";
import type { Brand, Category } from "@/lib/types";
import BrandMegaMenu from "./BrandMegaMenu";
import Logo from "./Logo";
import MegaMenu from "./MegaMenu";

const nav = [
  { href: "/collections/all?sale=1", label: "Flash Deals", hot: true },
  { href: "/collections/all?sort=new", label: "New In" },
  { href: "/collections/all", label: "All Styles" },
  { href: "/sellers", label: "Boutiques" },
  { href: "/blog", label: "Style Journal" },
];

/** Search suggestions shown under the box, like a marketplace's "trending" row. */
const HOT_SEARCHES: [label: string, q: string][] = [
  ["Floral midi dress", "floral"],
  ["Cashmere sweater", "cashmere"],
  ["Trench coat", "trench"],
  ["High-waist jeans", "jeans"],
  ["Satin skirt", "satin"],
  ["Yoga set", "yoga"],
];

type MenuKind = "cats" | "brands" | null;
type SearchMode = "items" | "shops";

export default function Header({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const { user } = useAuth();
  const { count, wishlist } = useShop();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("items");
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
    setMobileOpen(false);
    if (mode === "shops") {
      router.push("/sellers");
      return;
    }
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(`/collections/all${qs ? `?${qs}` : ""}`);
  };

  const searchBox = (id: string) => (
    <div>
      <div className="mb-1 hidden gap-1 pl-2 md:flex" role="tablist" aria-label="Search in">
        {(["items", "shops"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-t-md px-3.5 py-1 text-xs font-bold transition ${mode === m ? "bg-accent text-white" : "text-[#666] hover:text-accent"}`}
          >
            {m === "items" ? "Items" : "Shops"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} role="search" className="search-frame flex h-10 w-full items-center bg-white pl-4 pr-[3px] md:h-11">
        <label htmlFor={`${id}-q`} className="sr-only">Search</label>
        <input
          id={`${id}-q`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mode === "items" ? "Search dresses, knitwear, jeans…" : "Search boutiques"}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-[#999]"
        />
        <button
          type="submit"
          className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-bright to-accent px-5 text-sm font-bold text-white transition hover:brightness-95 md:h-[38px] md:px-7"
        >
          <Search className="h-4 w-4 md:hidden" aria-hidden />
          <span className="hidden md:inline">Search</span>
          <span className="sr-only md:hidden">Search</span>
        </button>
      </form>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_#eee]">
      <div className="container-x flex items-end gap-4 pb-2.5 pt-3 md:gap-8">
        <button className="mb-1.5 text-[#555] lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <Logo className="mb-0.5" />
        <div className="hidden flex-1 md:block md:max-w-[680px]">
          {searchBox("desk")}
          <p className="mt-1.5 flex gap-4 overflow-hidden whitespace-nowrap pl-3 text-xs text-[#999]">
            {HOT_SEARCHES.map(([label, term], i) => (
              <Link key={label} href={`/collections/all?q=${term}`} className={`transition hover:text-accent ${i === 0 ? "font-semibold text-accent" : ""}`}>
                {label}
              </Link>
            ))}
          </p>
        </div>
        <div className="mb-1 ml-auto flex items-center gap-3 md:ml-0">
          <Link
            href="/wishlist"
            className="relative hidden h-10 items-center gap-1.5 rounded-full border border-[#e8e8e8] px-4 text-sm text-[#555] transition hover:border-accent hover:text-accent sm:flex"
            aria-label={`Wishlist, ${wishlist.length} items`}
          >
            <Heart className="h-[18px] w-[18px] text-accent" />
            Wishlist
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 items-center gap-1.5 rounded-full border border-accent bg-white px-4 text-sm font-semibold text-accent transition hover:bg-brand-50"
            aria-label={`Cart, ${count} items`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">My Cart</span>
            {count > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{count}</span>
            )}
          </Link>
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">{searchBox("mob")}</div>

      {/* Category / link row */}
      <nav className="relative hidden border-t border-[#f0f0f0] bg-white lg:block" aria-label="Main" onMouseLeave={scheduleClose}>
        <div className="container-x flex items-center">
          <div onMouseEnter={() => open("cats")}>
            <button
              onClick={() => setOpenMenu(openMenu === "cats" ? null : "cats")}
              aria-expanded={openMenu === "cats"}
              className={`flex items-center gap-2 py-2.5 pr-6 text-sm font-bold transition ${openMenu === "cats" ? "text-accent" : "text-ink hover:text-accent"}`}
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} />
              All Categories
              <ChevronDown className={`h-4 w-4 text-[#999] transition ${openMenu === "cats" ? "rotate-180" : ""}`} />
            </button>
          </div>
          <ul className="flex items-center">
            {nav.map((n) => (
              <li key={n.label} onMouseEnter={() => open(null)}>
                <Link href={n.href} className={`block px-4 py-2.5 text-sm transition hover:text-accent ${n.hot ? "font-bold text-accent" : "text-[#555]"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li onMouseEnter={() => open("brands")}>
              <Link
                href="/brands"
                onClick={() => setOpenMenu(null)}
                className={`flex items-center px-4 py-2.5 text-sm transition hover:text-accent ${openMenu === "brands" ? "text-accent" : "text-[#555]"}`}
              >
                Brands
                <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-[#999]" />
              </Link>
            </li>
          </ul>
          <p className="ml-auto text-xs text-[#999]" onMouseEnter={() => open(null)}>
            Free shipping over $99 · 30-day returns
          </p>
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
            <div className="flex items-center justify-between bg-gradient-to-r from-accent-bright to-accent p-4">
              <Logo tone="light" />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="divide-y divide-[#f0f0f0]">
              <Link href={user ? "/account" : "/login"} onClick={() => setMobileOpen(false)} className="block px-5 py-3.5 font-bold text-accent">
                {user ? "My account" : "Sign in / Register"}
              </Link>
              {nav.map((n) => (
                <Link key={n.label} href={n.href} onClick={() => setMobileOpen(false)} className="block px-5 py-3.5 font-semibold">
                  {n.label}
                </Link>
              ))}
              <Link href="/brands" onClick={() => setMobileOpen(false)} className="block px-5 py-3.5 font-semibold">
                Brands
              </Link>
              <p className="px-5 pb-1 pt-5 text-xs font-semibold text-muted">Categories</p>
              {categories.map((c) => (
                <Link key={c.slug} href={`/collections/${c.slug}`} onClick={() => setMobileOpen(false)} className="block px-5 py-3 text-sm">
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

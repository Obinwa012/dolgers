"use client";

import { ChevronDown, Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useShop } from "@/context/ShopProvider";

/** Thin utility bar above the header: greeting and sign-in on the left, personal shortcuts on the right. */
export default function TopBar() {
  const { user } = useAuth();
  const { count, wishlist } = useShop();
  const link = "flex items-center gap-1 px-2.5 py-1 transition hover:text-accent";

  return (
    <div className="hidden border-b border-[#eee] bg-[#f5f5f5] text-xs text-[#666] sm:block" aria-label="Account shortcuts">
      <div className="container-x flex h-8 items-center justify-between">
        <p className="flex items-center gap-1">
          <span className="px-2.5">Hi{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}!</span>
          {user ? (
            <Link href="/account" className="font-semibold text-accent hover:underline">My account</Link>
          ) : (
            <>
              <Link href="/login" className="font-semibold text-accent hover:underline">Sign in</Link>
              <Link href="/register" className="px-2.5 hover:text-accent">Register</Link>
            </>
          )}
        </p>
        <nav className="flex items-center divide-x divide-[#ddd]" aria-label="Utility">
          <Link href="/account" className={link}>My Orders</Link>
          <Link href="/wishlist" className={link}>
            <Heart className="h-3.5 w-3.5 text-accent" /> Wishlist{wishlist.length > 0 && ` (${wishlist.length})`}
          </Link>
          <Link href="/cart" className={link}>
            <ShoppingCart className="h-3.5 w-3.5 text-accent" /> Cart{count > 0 && ` (${count})`}
          </Link>
          <Link href="/sell" className={link}>Sell on Dolgers</Link>
          <Link href="/pages/contact" className={link}>
            Help <ChevronDown className="h-3 w-3" />
          </Link>
        </nav>
      </div>
    </div>
  );
}

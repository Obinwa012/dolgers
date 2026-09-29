"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { db } from "@/lib/firebase";
import { SELF_SELLER } from "@/lib/marketplace";
import type { CartItem, Product, Seller } from "@/lib/types";
import { useAuth } from "./AuthProvider";

const LS_CART = "torqline:cart";
const LS_WISH = "torqline:wishlist";

export interface CartLine extends CartItem {
  product: Product;
  variantName: string;
  price: number;
  compareAtPrice?: number;
}

interface ShopCtx {
  products: Product[];
  sellers: Seller[];
  sellerOf: (p: Product) => Seller | undefined;
  cart: CartItem[];
  lines: CartLine[];
  count: number;
  subtotal: number;
  wishlist: string[];
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  addToCart: (productId: string, variantId: string, qty?: number) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clearCart: () => void;
  toggleWish: (productId: string) => void;
  inWishlist: (productId: string) => boolean;
}

const Ctx = createContext<ShopCtx | null>(null);

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const out = [...a];
  for (const item of b) {
    const hit = out.find((x) => x.productId === item.productId && x.variantId === item.variantId);
    if (hit) hit.qty = Math.max(hit.qty, item.qty);
    else out.push({ ...item });
  }
  return out;
}

export function ShopProvider({
  products,
  sellers = [],
  children,
}: {
  products: Product[];
  sellers?: Seller[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // State, not a ref: the persist effect must not run until a render that already holds the
  // loaded values. With a ref, the first persist pass wrote [] over the saved cart, and under
  // StrictMode's double-invoked effects (next dev) the cart was wiped on every reload.
  const [hydrated, setHydrated] = useState(false);
  const syncedUid = useRef<string | null>(null);
  const prevUid = useRef<string | null>(null); // last signed-in uid, to detect sign-out

  // Guest state from localStorage on first mount.
  // (Read after mount, not in useState initializers, to avoid SSR hydration mismatches.)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCart(readLS(LS_CART, []));
    setWishlist(readLS(LS_WISH, []));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // On sign-in: merge guest cart/wishlist into the user's Firestore doc.
  // On sign-out: drop the account's cart/wishlist from this browser (shared computers).
  useEffect(() => {
    const d = db();
    const signedOut = !user && prevUid.current !== null;
    prevUid.current = user?.uid ?? null;
    if (!user || !d) {
      if (signedOut) {
        setCart([]);
        setWishlist([]);
      }
      syncedUid.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(d, "users", user.uid));
        const remote = snap.data() ?? {};
        if (cancelled) return;
        setCart((local) => mergeCarts(remote.cart ?? [], local));
        setWishlist((local) => Array.from(new Set([...(remote.wishlist ?? []), ...local])));
        syncedUid.current = user.uid;
      } catch (e) {
        console.warn("[shop] could not load user cart", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist on change: localStorage always, Firestore when signed in and synced.
  useEffect(() => {
    if (!hydrated) return;
    writeLS(LS_CART, cart);
    writeLS(LS_WISH, wishlist);
    const d = db();
    if (user && d && syncedUid.current === user.uid) {
      setDoc(doc(d, "users", user.uid), { cart, wishlist }, { merge: true }).catch((e) =>
        console.warn("[shop] sync failed", e),
      );
    }
  }, [hydrated, cart, wishlist, user]);

  const addToCart = useCallback((productId: string, variantId: string, qty = 1) => {
    setCart((c) => addQty(c, productId, variantId, qty));
    setDrawerOpen(true);
  }, []);

  const setQty = useCallback((productId: string, variantId: string, qty: number) => {
    setCart((c) =>
      qty <= 0
        ? c.filter((x) => !(x.productId === productId && x.variantId === variantId))
        : c.map((x) => (x.productId === productId && x.variantId === variantId ? { ...x, qty } : x)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback((id: string) => {
    setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  }, []);

  const lines = useMemo<CartLine[]>(() => {
    const out: CartLine[] = [];
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      const v = product?.variants.find((x) => x.id === item.variantId);
      if (product && v)
        out.push({ ...item, product, variantName: v.name, price: v.price, compareAtPrice: v.compareAtPrice });
    }
    return out;
  }, [cart, products]);

  const value: ShopCtx = {
    products,
    sellers,
    sellerOf: (p) => sellers.find((s) => s.slug === (p.seller || SELF_SELLER)),
    cart,
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
    wishlist,
    drawerOpen,
    setDrawerOpen,
    addToCart,
    setQty,
    clearCart,
    toggleWish,
    inWishlist: (id) => wishlist.includes(id),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function addQty(c: CartItem[], productId: string, variantId: string, qty: number): CartItem[] {
  const i = c.findIndex((x) => x.productId === productId && x.variantId === variantId);
  if (i === -1) return [...c, { productId, variantId, qty }];
  return c.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x));
}

export function useShop() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop must be used inside <ShopProvider>");
  return c;
}

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import * as local from "@/data/catalog";
import type { Brand, Category, Post, Product } from "./types";

/**
 * Catalog reads. Firestore is the source of truth once seeded (`npm run seed`).
 * If Firebase isn't configured or a collection is empty, the bundled demo data is used
 * so the storefront always renders.
 */
async function readAll<T>(name: string, fallback: T[]): Promise<T[]> {
  const d = db();
  if (!d) return fallback;
  try {
    const snap = await getDocs(collection(d, name));
    if (snap.empty) return fallback;
    return snap.docs.map((x) => ({ id: x.id, ...x.data() }) as T);
  } catch (err) {
    console.warn(`[catalog] Firestore read of "${name}" failed, using bundled data.`, err);
    return fallback;
  }
}

export const getProducts = () =>
  readAll<Product>("products", local.products).then((p) =>
    [...p].sort((a, b) => b.createdAt - a.createdAt),
  );
export const getCategories = () => readAll<Category>("categories", local.categories);
export const getBrands = () => readAll<Brand>("brands", local.brands);
export const getPosts = () =>
  readAll<Post>("posts", local.posts).then((p) => [...p].sort((a, b) => b.date.localeCompare(a.date)));

export async function getProduct(slug: string): Promise<Product | undefined> {
  const d = db();
  if (d) {
    try {
      const s = await getDoc(doc(d, "products", slug));
      if (s.exists()) return { id: s.id, ...s.data() } as Product;
    } catch {
      /* fall through */
    }
  }
  return local.products.find((p) => p.slug === slug);
}

export const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price));
export const onSale = (p: Product) => p.variants.some((v) => v.compareAtPrice && v.compareAtPrice > v.price);
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

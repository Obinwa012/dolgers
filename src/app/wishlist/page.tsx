import { getBrands } from "@/lib/catalog";
import WishlistGrid from "./WishlistGrid";

export const metadata = { title: "Wishlist" };
export const revalidate = 300;

export default async function WishlistPage() {
  return <WishlistGrid brands={await getBrands()} />;
}

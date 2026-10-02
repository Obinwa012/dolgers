import Link from "next/link";
import { GarmentIcon } from "@/components/ClothingArt";
import { getBrands } from "@/lib/catalog";

export const metadata = { title: "Brands" };
export const revalidate = 300;

export default async function BrandsPage() {
  const brands = await getBrands();
  return (
    <div className="container-x py-10">
      <h1 className="section-title mb-10">Our brands</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => {
          return (
            <Link key={b.slug} href={`/brands/${b.slug}`} className="relative flex h-44 items-start overflow-hidden rounded-xl p-6" style={{ background: b.color, color: b.textColor }}>
              <span className="text-3xl font-black">{b.name}</span>
              <GarmentIcon icon={b.icon} className="absolute -bottom-4 right-3 h-32 w-32 opacity-25" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

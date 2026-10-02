import Link from "next/link";
import ClothingArt from "@/components/ClothingArt";
import { getPosts } from "@/lib/catalog";

export const metadata = { title: "Style Journal" };
export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <div className="container-x py-10">
      <h1 className="section-title mb-10">Style Journal</h1>
      <div className="grid gap-8 md:grid-cols-3">
        {posts.map((p) => (
          <article key={p.slug} className="group">
            <Link href={`/blog/${p.slug}`} className="block aspect-[16/10] overflow-hidden rounded-lg">
              <ClothingArt icon={p.icon} tint={p.tint} variant="bold" alt="" className="transition duration-500 group-hover:scale-105" />
            </Link>
            <p className="mt-4 text-xs text-muted">{new Date(p.date).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })} / {p.author}</p>
            <h2 className="mt-2 text-xl font-bold"><Link href={`/blog/${p.slug}`} className="hover:text-brand-600">{p.title}</Link></h2>
            <p className="mt-2 text-sm text-muted">{p.excerpt}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

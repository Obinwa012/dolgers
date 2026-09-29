import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ToolArt from "@/components/ToolArt";
import { getPosts } from "@/lib/catalog";

export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = (await getPosts()).find((x) => x.slug === slug);
  return { title: p?.title ?? "Blog", description: p?.excerpt };
}

export default async function PostPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = (await getPosts()).find((x) => x.slug === slug);
  if (!post) notFound();
  return (
    <article className="container-x max-w-3xl py-10">
      <Link href="/blog" className="text-sm text-muted hover:text-ink">← Workshop blog</Link>
      <h1 className="mt-4 font-display text-4xl uppercase leading-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-muted">{new Date(post.date).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })} / {post.author}</p>
      <div className="my-8 aspect-[16/8] overflow-hidden rounded-xl">
        <ToolArt icon={post.icon} tint={post.tint} variant="bold" alt="" />
      </div>
      <div className="space-y-5 text-lg leading-relaxed">
        {post.body.map((para, i) => <p key={i}>{para}</p>)}
      </div>
    </article>
  );
}

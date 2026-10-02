import type { Metadata } from "next";
import { notFound } from "next/navigation";

const PAGES: Record<string, { title: string; body: string[] }> = {
  about: { title: "About Dolgers", body: ["Dolgers is a demo women's fashion store built with Next.js, Tailwind CSS and Firebase.", "Replace this copy with your own story."] },
  shipping: { title: "Shipping & Returns", body: ["Orders over $99 ship free within the contiguous US.", "Unworn items with tags attached can be returned within the window shown on each listing, usually 30 days."] },
  contact: { title: "Contact Us", body: ["Email hello@dolgers.example or call (555) 010-4477, Monday to Saturday."] },
  privacy: { title: "Privacy Policy", body: ["Placeholder policy. Replace with your own before launch."] },
  terms: { title: "Terms of Service", body: ["Placeholder terms. Replace with your own before launch."] },
  accessibility: { title: "Accessibility", body: ["We aim to meet WCAG 2.2 AA. Tell us if something doesn't work for you: hello@dolgers.example."] },
  careers: { title: "Careers", body: ["No open roles right now. Check back soon."] },
};

export async function generateMetadata(props: PageProps<"/pages/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: PAGES[slug]?.title ?? "Page" };
}

export default async function InfoPage(props: PageProps<"/pages/[slug]">) {
  const { slug } = await props.params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-black">{page.title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        {page.body.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}

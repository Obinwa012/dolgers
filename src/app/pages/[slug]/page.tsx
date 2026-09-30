import type { Metadata } from "next";
import { notFound } from "next/navigation";

const PAGES: Record<string, { title: string; body: string[] }> = {
  about: { title: "About Dolgers", body: ["Dolgers is a demo tool store built with Next.js, Tailwind CSS and Firebase.", "Replace this copy with your own story."] },
  shipping: { title: "Shipping & Returns", body: ["Orders over $99 ship free within the contiguous US.", "Unused items can be returned within 30 days."] },
  warranty: { title: "Warranty", body: ["Powered tools carry a 3-year warranty against manufacturing defects."] },
  contact: { title: "Contact Us", body: ["Email hello@dolgers.example or call (555) 010-4477, 7 days a week."] },
  privacy: { title: "Privacy Policy", body: ["Placeholder policy. Replace with your own before launch."] },
  trade: { title: "Trade Accounts", body: ["Trade accounts get net-30 terms and volume pricing. Contact us to apply."] },
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
      <h1 className="font-display text-4xl uppercase">{page.title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        {page.body.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}

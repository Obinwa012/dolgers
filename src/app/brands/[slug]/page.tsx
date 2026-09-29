import { redirect } from "next/navigation";

export default async function BrandPage(props: PageProps<"/brands/[slug]">) {
  const { slug } = await props.params;
  redirect(`/collections/all?brand=${encodeURIComponent(slug)}`);
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEPARTMENTS, type Category } from '@dolgers/shared';
import { loadListing } from '@/components/shop/listing-data';
import { ShopListing, type Chip } from '@/components/shop/ShopListing';
import { getCategories } from '@/lib/server/catalog';

// Always render from live Firestore: never serve a stale pre-built copy of the catalog.
export const dynamic = 'force-dynamic';

function cleanPath(path: string[] | undefined): string[] {
  return (path ?? []).slice(0, 4).map((s) => decodeURIComponent(s).toLowerCase());
}

function categoryTitle(c: Category): string {
  if (c.path.length === 1) return c.name;
  return c.department === 'boys' ? `Boys' ${c.name}` : c.department === 'men' ? `Men's ${c.name}` : c.name;
}

export async function generateMetadata({ params }: PageProps<'/shop/[[...path]]'>): Promise<Metadata> {
  const path = cleanPath((await params).path);
  if (!path.length) return { title: 'Shop all', description: 'Every piece from our independent labels for men and boys.', alternates: { canonical: '/shop' } };
  const category = (await getCategories()).find((c) => c.id === path.join('--'));
  if (!category) return { title: 'Not found' };
  return {
    title: categoryTitle(category),
    description: category.description || `${categoryTitle(category)} from independent labels on DOLGERS.`,
    alternates: { canonical: `/shop/${path.join('/')}` },
  };
}

export default async function ShopPage({ params, searchParams }: PageProps<'/shop/[[...path]]'>) {
  const path = cleanPath((await params).path);
  const sp = await searchParams;
  const categories = await getCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathname = path.length ? `/shop/${path.join('/')}` : '/shop';

  if (!path.length) {
    const { state, result } = await loadListing(sp, {});
    const chips: Chip[] = [
      { label: 'All', href: '/shop', active: true },
      ...categories.filter((c) => c.parentId === null).map((c) => ({ label: c.name, href: `/shop/${c.path.join('/')}`, active: false })),
    ];
    return (
      <ShopListing
        pathname={pathname}
        state={state}
        result={result}
        title="Shop all"
        description="Every piece from every maker on DOLGERS, for men and boys."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop' }]}
        chips={chips}
        emptyMessage="No products yet. Check back soon."
      />
    );
  }

  const category = byId.get(path.join('--'));
  if (!category) notFound();

  const { state, result } = await loadListing(sp, { categoryId: category.id });

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    ...category.path.map((_, i) => {
      const c = byId.get(category.path.slice(0, i + 1).join('--'));
      const last = i === category.path.length - 1;
      return { label: c?.name ?? category.path[i], href: last ? undefined : `/shop/${category.path.slice(0, i + 1).join('/')}` };
    }),
  ];

  // MEN / BOYS: the same category in the other department, or its nearest existing parent.
  const departments: Chip[] | undefined = category.department
    ? DEPARTMENTS.map((dept) => {
        let target = [dept, ...category.path.slice(1)];
        while (target.length > 1 && !byId.has(target.join('--'))) target = target.slice(0, -1);
        return { label: dept === 'men' ? 'Men' : 'Boys', href: `/shop/${target.join('/')}`, active: dept === category.department };
      }).filter((d) => byId.has(d.href.slice('/shop/'.length).split('/').join('--')))
    : undefined;

  const children = categories.filter((c) => c.parentId === category.id);
  const parent = category.parentId ? byId.get(category.parentId) : undefined;
  let chips: Chip[] = [];
  if (children.length) {
    chips = [{ label: 'All', href: pathname, active: true }, ...children.map((c) => ({ label: c.name, href: `/shop/${c.path.join('/')}`, active: false }))];
  } else if (parent && parent.parentId !== null) {
    const siblings = categories.filter((c) => c.parentId === parent.id);
    chips = [
      { label: 'All', href: `/shop/${parent.path.join('/')}`, active: false },
      ...siblings.map((c) => ({ label: c.name, href: `/shop/${c.path.join('/')}`, active: c.id === category.id })),
    ];
  }

  return (
    <ShopListing
      pathname={pathname}
      state={state}
      result={result}
      title={category.name}
      description={category.description || undefined}
      breadcrumbs={breadcrumbs}
      departments={departments && departments.length > 1 ? departments : undefined}
      chips={chips}
      emptyMessage="No products here yet. Check back soon."
    />
  );
}

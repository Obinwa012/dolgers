// Demo catalog taken from the DOLGERS mockup. It seeds the Firebase emulators and a fresh
// project (`npm run seed`), and the website falls back to it when no database is configured so
// the storefront can be previewed without any accounts.
import { SIZE_LABELS } from './constants.ts';
import { slugify } from './slug.ts';
import type {
  Category,
  Department,
  HomeContent,
  Product,
  ProductImage,
  SizeSystem,
  Vendor,
} from './types.ts';

const T0 = Date.UTC(2026, 8, 1);
const DAY = 86_400_000;

export function categoryId(path: string[]): string {
  return path.join('--');
}

/** Every ancestor id of a category path: ['men','outerwear'] -> ['men','men--outerwear']. */
export function categoryIdsFromPath(path: string[]): string[] {
  return path.map((_, i) => categoryId(path.slice(0, i + 1)));
}

function cat(path: string[], name: string, order: number, description = '', tone?: string): Category {
  return {
    id: categoryId(path),
    slug: path[path.length - 1],
    name,
    parentId: path.length > 1 ? categoryId(path.slice(0, -1)) : null,
    path,
    department: (path[0] === 'men' || path[0] === 'boys' ? path[0] : null) as Department | null,
    description,
    order,
    tone,
  };
}

export const demoCategories: Category[] = [
  cat(['men'], 'Men', 0, 'Tailoring, outerwear and everyday essentials, built to last more than a season.', 'charcoal'),
  cat(['men', 'outerwear'], 'Outerwear', 0, 'Overcoats, field jackets and gilets from independent makers, built for real weather and years of wear.', 'stone'),
  cat(['men', 'outerwear', 'coats'], 'Coats', 0),
  cat(['men', 'outerwear', 'jackets'], 'Jackets', 1),
  cat(['men', 'outerwear', 'overshirts'], 'Overshirts', 2),
  cat(['men', 'outerwear', 'gilets'], 'Gilets', 3),
  cat(['men', 'knitwear'], 'Knitwear', 1, 'Merino, lambswool and cashmere knits made to be worn hard and mended.', 'sand'),
  cat(['men', 'denim-trousers'], 'Denim & Trousers', 2, 'Selvedge denim and pleated wool trousers, cut to sit right for years.', 'grey'),
  cat(['men', 'shoes'], 'Shoes', 3, 'Chelsea boots, loafers and weatherproof runners from makers who still resole what they sell.', 'charcoal'),
  cat(['men', 'accessories'], 'Accessories', 4, 'Scarves, caps and the small things that finish a look.', 'ecru'),
  cat(['boys'], 'Boys', 1, 'Durable, washable pieces cut for growing up: from the playground to the weekend.', 'stone'),
  cat(['boys', 'outerwear'], 'Outerwear', 0, 'Puffers, duffles and overshirts with room for layering.', 'stone'),
  cat(['boys', 'knitwear'], 'Knitwear', 1, 'Soft, hard-wearing jumpers for school and weekends.', 'sand'),
  cat(['boys', 'trousers'], 'Trousers', 2, 'Chinos and cords that survive the playground.', 'grey'),
];

function vendor(
  slug: string,
  name: string,
  tagline: string,
  facts: Vendor['facts'],
  departments: Department[],
  tone: string,
): Vendor {
  return {
    id: slug,
    slug,
    name,
    tagline,
    storyTitle: 'Made slowly, worn for years',
    story:
      `${name} started with a single workroom and a simple rule: make fewer things, and make them properly.\n\n` +
      'Every piece is cut in small runs from cloth sourced close to home, finished by hand and checked before it leaves the bench.\n\n' +
      'If something wears out, send it back. Repairs are part of the price.',
    banner: { url: '', alt: `${name} workshop, supplied by the maker`, tone },
    storyImage: { url: '', alt: `Pattern cutting at the ${name} workshop`, tone: 'stone' },
    facts,
    departments,
    status: 'active',
    followerCount: 0,
    productCount: 0,
    createdAt: T0,
    updatedAt: T0,
  };
}

export const demoVendors: Vendor[] = [
  vendor('nordhavn', 'Nordhavn', 'Coats and knitwear made in small runs in Maine, cut to be worn for a decade rather than a season.',
    { founded: '2011', basedIn: 'Portland, Maine', madeIn: 'USA', shipsFrom: 'Portland, Maine', dispatchDays: [2, 4] }, ['men', 'boys'], 'charcoal'),
  vendor('ashby-and-sons', 'Ashby & Sons', 'Third-generation shirtmakers turned field-jacket specialists.',
    { founded: '1968', basedIn: 'Brooklyn, New York', madeIn: 'USA', shipsFrom: 'Brooklyn, New York', dispatchDays: [1, 3] }, ['men'], 'sand'),
  vendor('tarn-supply', 'Tarn Supply', 'Technical outerwear and selvedge denim for weather that does not care about your plans.',
    { founded: '2016', basedIn: 'Seattle, Washington', madeIn: 'USA and Japan', shipsFrom: 'Seattle, Washington', dispatchDays: [2, 5] }, ['men', 'boys'], 'grey'),
  vendor('dolgers-studio', 'DOLGERS Studio', 'Our own label: leather, suede and the pieces we could not find elsewhere.',
    { founded: '2026', basedIn: 'New York', madeIn: 'Portugal', shipsFrom: 'New Jersey', dispatchDays: [1, 2] }, ['men', 'boys'], 'black'),
  vendor('fellow-and-field', 'Fellow & Field', 'Kidswear built like grown-up clothes, then washed a hundred times to prove it.',
    { founded: '2019', basedIn: 'Austin, Texas', madeIn: 'USA', shipsFrom: 'Austin, Texas', dispatchDays: [2, 4] }, ['boys'], 'ecru'),
  vendor('marlowe', 'Marlowe', 'Tailoring and trousers from a two-person atelier in Philadelphia.',
    { founded: '2014', basedIn: 'Philadelphia, Pennsylvania', madeIn: 'USA', shipsFrom: 'Philadelphia, Pennsylvania', dispatchDays: [3, 6] }, ['men'], 'stone'),
];

interface DemoProductSpec {
  title: string;
  vendor: string;
  path: string[];
  colour: [string, string];
  price: number;
  sizeSystem: SizeSystem;
  tone: string;
  imageLabels: string[];
  description: string;
  composition?: string;
  care?: string;
  fitNote?: string;
  soldOut?: string[];
  sizes?: string[];
  ageDays: number;
  featured?: boolean;
}

const specs: DemoProductSpec[] = [
  { title: 'Double-Faced Wool Overcoat', vendor: 'nordhavn', path: ['men', 'outerwear', 'coats'], colour: ['Charcoal', '#3d3b38'], price: 420, sizeSystem: 'alpha', tone: 'charcoal',
    imageLabels: ['Front, charcoal', 'Back, charcoal', 'Collar and lapel detail', 'On model, styled with knitwear'],
    description: 'Cut from double-faced virgin wool and left unlined for a soft, unstructured drape. Notch lapel, two flap pockets and a single back vent.',
    composition: '100% virgin wool.', care: 'Dry clean only.', fitNote: 'Relaxed fit: if between sizes, take the smaller.', soldOut: ['XXL'], ageDays: 3, featured: true },
  { title: 'Waxed Cotton Field Jacket', vendor: 'ashby-and-sons', path: ['men', 'outerwear', 'jackets'], colour: ['Tobacco', '#7a5636'], price: 285, sizeSystem: 'alpha', tone: 'sand',
    imageLabels: ['Field jacket, tobacco', 'Back, tobacco', 'Corduroy collar detail'],
    description: 'Waxed cotton shell with a corduroy collar, four bellows pockets and a two-way brass zip. Rewaxes in an afternoon.',
    composition: '100% cotton, paraffin wax finish. Cotton twill lining.', care: 'Wipe clean. Rewax yearly.', fitNote: 'True to size with room for a knit underneath.', ageDays: 50, featured: true },
  { title: 'Quilted Down Gilet', vendor: 'tarn-supply', path: ['men', 'outerwear', 'gilets'], colour: ['Slate', '#6b7075'], price: 165, sizeSystem: 'alpha', tone: 'grey',
    imageLabels: ['Gilet, slate', 'Back, slate'], description: 'Responsibly sourced down in a recycled ripstop shell. Packs into its own pocket.',
    composition: 'Recycled nylon shell, 90/10 RDS down fill.', care: 'Machine wash cold, tumble dry low with dryer balls.', fitNote: 'Slim through the body.', ageDays: 40 },
  { title: 'Suede Trucker Jacket', vendor: 'dolgers-studio', path: ['men', 'outerwear', 'jackets'], colour: ['Sand', '#cdb999'], price: 540, sizeSystem: 'alpha', tone: 'stone',
    imageLabels: ['Trucker, sand suede', 'Back, sand suede', 'Button and pocket detail'], description: 'Goat suede cut to the classic trucker pattern, with corozo buttons and a cotton-lined body.',
    composition: '100% goat suede. 100% cotton lining.', care: 'Specialist leather clean only.', fitNote: 'Cropped at the waist. Take your usual size.', ageDays: 5 },
  { title: 'Brushed Flannel Overshirt', vendor: 'ashby-and-sons', path: ['men', 'outerwear', 'overshirts'], colour: ['Oat', '#d8cdb8'], price: 120, sizeSystem: 'alpha', tone: 'ecru',
    imageLabels: ['Overshirt, oatmeal', 'Back, oatmeal'], description: 'Heavy brushed cotton flannel with two chest pockets. Works as a shirt or a light jacket.',
    composition: '100% cotton flannel.', care: 'Machine wash at 30°C.', fitNote: 'Boxy fit. Size down for a closer shirt fit.', ageDays: 70 },
  { title: 'Technical Rain Parka', vendor: 'tarn-supply', path: ['men', 'outerwear', 'coats'], colour: ['Black', '#111111'], price: 340, sizeSystem: 'alpha', tone: 'black',
    imageLabels: ['Parka, black', 'Hood detail'], description: 'Three-layer waterproof membrane with taped seams, a storm hood and underarm vents.',
    composition: 'Recycled polyester face, PFC-free membrane.', care: 'Machine wash cold, reproof yearly.', fitNote: 'Regular fit with room for layers.', ageDays: 8 },
  { title: 'Shearling-Collar Bomber', vendor: 'nordhavn', path: ['men', 'outerwear', 'jackets'], colour: ['Espresso', '#4a3428'], price: 465, sizeSystem: 'alpha', tone: 'charcoal',
    imageLabels: ['Bomber, espresso', 'Shearling collar detail'], description: 'Wool melton bomber with a detachable shearling collar and rib cuffs.',
    composition: '80% wool, 20% nylon. Shearling collar.', care: 'Dry clean only.', fitNote: 'Fitted through the waist.', ageDays: 45 },
  { title: 'Herringbone Wool Overshirt', vendor: 'marlowe', path: ['men', 'outerwear', 'overshirts'], colour: ['Grey', '#9a9893'], price: 195, sizeSystem: 'alpha', tone: 'grey',
    imageLabels: ['Overshirt, grey herringbone', 'Back, grey herringbone'], description: 'British herringbone tweed overshirt with horn buttons and a half lining.',
    composition: '100% wool tweed.', care: 'Dry clean only.', fitNote: 'Regular fit.', ageDays: 60 },
  { title: 'Merino Rib Crewneck', vendor: 'ashby-and-sons', path: ['men', 'knitwear'], colour: ['Ecru', '#ece6d8'], price: 145, sizeSystem: 'alpha', tone: 'ecru',
    imageLabels: ['Crewneck, ecru', 'Rib detail'], description: 'Extra-fine merino knitted in a 2x2 rib. Warm, breathable and easy to wash.',
    composition: '100% extra-fine merino wool.', care: 'Hand wash cold, dry flat.', fitNote: 'True to size.', ageDays: 2, featured: true },
  { title: 'Lambswool Fisherman Sweater', vendor: 'nordhavn', path: ['men', 'knitwear'], colour: ['Ecru', '#ece6d8'], price: 230, sizeSystem: 'alpha', tone: 'ecru',
    imageLabels: ['Fisherman knit, ecru', 'Cable detail'], description: 'Heavyweight cable knit in undyed lambswool, finished with a ribbed crew neck.',
    composition: '100% lambswool.', care: 'Hand wash cold, dry flat.', fitNote: 'Generous fit. Size down for a closer fit.', ageDays: 6 },
  { title: 'Selvedge Straight Jean', vendor: 'tarn-supply', path: ['men', 'denim-trousers'], colour: ['Indigo', '#2c3a5c'], price: 160, sizeSystem: 'waist', tone: 'grey',
    imageLabels: ['Jean, indigo rinse', 'Selvedge detail'], description: '14oz Japanese selvedge denim, one rinse, straight leg with a mid rise.',
    composition: '100% cotton selvedge denim.', care: 'Wash inside out, cold, rarely.', fitNote: 'Straight leg, mid rise. 34 inch inseam.', ageDays: 20, featured: true },
  { title: 'Pleated Wool Trouser', vendor: 'marlowe', path: ['men', 'denim-trousers'], colour: ['Grey', '#9a9893'], price: 210, sizeSystem: 'waist', tone: 'grey',
    imageLabels: ['Trouser, mid grey', 'Pleat detail'], description: 'Single forward pleat, side adjusters and a tapered leg in Italian wool flannel.',
    composition: '100% wool flannel.', care: 'Dry clean only.', fitNote: 'High rise, tapered leg.', ageDays: 33 },
  { title: 'Leather Chelsea Boot', vendor: 'dolgers-studio', path: ['men', 'shoes'], colour: ['Black', '#111111'], price: 295, sizeSystem: 'eu-shoe', tone: 'black',
    imageLabels: ['Side profile, black', 'Pair from above, black', 'Sole and welt detail', 'On foot, with selvedge denim'],
    description: 'Full-grain calf leather upper on a stitched, resoleable rubber sole. Elasticated side panels and a pull tab at the heel.',
    composition: 'Leather upper and lining. Rubber sole.', care: 'Wipe clean and condition with neutral cream.', fitNote: 'True to size; between sizes, take the larger.',
    soldOut: ['46'], sizes: ['40', '41', '42', '43', '44', '45', '46'], ageDays: 4, featured: true },
  { title: 'Suede Penny Loafer', vendor: 'marlowe', path: ['men', 'shoes'], colour: ['Tobacco', '#7a5636'], price: 260, sizeSystem: 'eu-shoe', tone: 'sand',
    imageLabels: ['Suede loafer, tobacco', 'Sole detail'], description: 'Unlined suede penny loafer on a Goodyear-welted leather sole.',
    composition: 'Suede upper, leather sole.', care: 'Brush after wear.', fitNote: 'Runs half a size large.', sizes: ['40', '41', '42', '43', '44', '45'], ageDays: 25 },
  { title: 'Weatherproof Runner', vendor: 'tarn-supply', path: ['men', 'shoes'], colour: ['Olive', '#5c5a3f'], price: 180, sizeSystem: 'eu-shoe', tone: 'grey',
    imageLabels: ['Runner, olive', 'Tread detail'], description: 'Waterproof trail runner with a recycled mesh upper and a grippy lugged sole.',
    composition: 'Recycled polyester upper, rubber sole.', care: 'Hand wash, air dry.', fitNote: 'True to size.', sizes: ['40', '41', '42', '43', '44', '45', '46'], ageDays: 55 },
  { title: 'Cashmere Ribbed Scarf', vendor: 'nordhavn', path: ['men', 'accessories'], colour: ['Oat', '#d8cdb8'], price: 165, sizeSystem: 'one-size', tone: 'sand',
    imageLabels: ['Scarf, oat'], description: 'Fully fashioned cashmere scarf in a soft rib. 180 x 30 cm.',
    composition: '100% cashmere.', care: 'Hand wash cold.', ageDays: 15 },
  { title: 'Wool Watch Cap', vendor: 'nordhavn', path: ['men', 'accessories'], colour: ['Grey', '#9a9893'], price: 60, sizeSystem: 'one-size', tone: 'grey',
    imageLabels: ['Watch cap, grey'], description: 'Double-layer rib watch cap in recycled wool.', composition: '100% recycled wool.', care: 'Hand wash cold.', ageDays: 80 },
  { title: "Boys' Quilted Puffer Jacket", vendor: 'tarn-supply', path: ['boys', 'outerwear'], colour: ['Black', '#111111'], price: 110, sizeSystem: 'age', tone: 'black',
    imageLabels: ['Front, black', 'Back, black', 'Hood and zip detail', 'On model, school-run layers'],
    description: 'Recycled nylon shell with a water-repellent finish and lightweight synthetic fill. Two-way zip, fixed hood and elasticated cuffs.',
    composition: 'Recycled nylon shell, recycled polyester fill.', care: 'Machine washable at 30°C.', fitNote: 'Cut with extra room through the body and sleeves for layering.',
    soldOut: ['4–5Y'], sizes: ['4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y', '14–15Y'], ageDays: 9, featured: true },
  { title: "Boys' Wool-Blend Duffle Coat", vendor: 'nordhavn', path: ['boys', 'outerwear'], colour: ['Camel', '#b89a74'], price: 145, sizeSystem: 'age', tone: 'sand',
    imageLabels: ['Duffle, camel', 'Toggle detail'], description: 'Classic duffle in a hard-wearing wool blend, with horn-effect toggles and a check lining.',
    composition: '70% wool, 30% polyamide.', care: 'Machine wash cold, wool cycle.', fitNote: 'Room to grow: take their usual size.', ageDays: 35 },
  { title: "Boys' Fleece-Lined Overshirt", vendor: 'fellow-and-field', path: ['boys', 'outerwear'], colour: ['Ecru', '#ece6d8'], price: 75, sizeSystem: 'age', tone: 'ecru',
    imageLabels: ['Overshirt, ecru check'], description: 'Brushed check cotton lined with recycled fleece. Snap buttons small hands can manage.',
    composition: '100% cotton shell, recycled polyester fleece.', care: 'Machine wash at 30°C.', fitNote: 'Regular fit.', ageDays: 22 },
  { title: "Boys' Corduroy Overshirt", vendor: 'dolgers-studio', path: ['boys', 'outerwear'], colour: ['Charcoal', '#3d3b38'], price: 70, sizeSystem: 'age', tone: 'charcoal',
    imageLabels: ['Cord overshirt, charcoal'], description: 'Eight-wale cord overshirt with two patch pockets and reinforced elbows.',
    composition: '100% cotton corduroy.', care: 'Machine wash at 30°C.', fitNote: 'Regular fit.', ageDays: 48 },
  { title: "Boys' Cable-Knit Jumper", vendor: 'nordhavn', path: ['boys', 'knitwear'], colour: ['Oat', '#d8cdb8'], price: 85, sizeSystem: 'age', tone: 'sand',
    imageLabels: ['Jumper, oat'], description: 'Soft cable knit in a machine-washable merino blend.', composition: '60% merino, 40% cotton.', care: 'Machine wash cold, wool cycle.', ageDays: 7 },
  { title: "Boys' Stretch Chino", vendor: 'fellow-and-field', path: ['boys', 'trousers'], colour: ['Navy', '#1f2a44'], price: 55, sizeSystem: 'age', tone: 'grey',
    imageLabels: ['Chino, navy'], description: 'Stretch cotton twill with an adjustable waist and double knees.', composition: '98% cotton, 2% elastane.', care: 'Machine wash at 40°C.', fitNote: 'Slim leg, adjustable waist.', ageDays: 65 },
];

function images(spec: DemoProductSpec): ProductImage[] {
  return spec.imageLabels.map((label) => ({ url: '', alt: label, tone: spec.tone }));
}

export function skuFor(productId: string, size: string): string {
  return `${productId}-${slugify(size)}`.slice(0, 128);
}

export const demoProducts: Product[] = specs.map((spec) => {
  const id = slugify(spec.title);
  const v = demoVendors.find((x) => x.id === spec.vendor)!;
  const sizes = spec.sizes ?? SIZE_LABELS[spec.sizeSystem].filter((s) => spec.sizeSystem !== 'waist' || ['30', '31', '32', '33', '34', '36'].includes(s));
  const price = spec.price * 100;
  return {
    id,
    slug: id,
    vendorId: v.id,
    vendorSlug: v.slug,
    vendorName: v.name,
    department: spec.path[0] as Department,
    categoryId: categoryId(spec.path),
    categoryPath: spec.path,
    title: spec.title,
    description: spec.description,
    composition: spec.composition ?? '',
    care: spec.care ?? '',
    fitNote: spec.fitNote ?? '',
    sizeSystem: spec.sizeSystem,
    colour: { name: spec.colour[0], hex: spec.colour[1] },
    images: images(spec),
    variants: sizes.map((size) => ({ sku: skuFor(id, size), size, price, compareAtPrice: null })),
    priceMin: price,
    priceMax: price,
    related: [],
    status: 'live',
    reviewNote: '',
    featured: spec.featured ?? false,
    // Relative to today so the demo always has a fresh "New in" edit.
    publishedAt: Date.now() - spec.ageDays * DAY,
    createdAt: T0,
    updatedAt: T0,
  };
});

// "Complete the look": a few pieces from the same department.
for (const p of demoProducts) {
  p.related = demoProducts
    .filter((o) => o.id !== p.id && o.department === p.department && o.categoryPath[1] !== p.categoryPath[1])
    .slice(0, 4)
    .map((o) => o.id);
}
for (const v of demoVendors) v.productCount = demoProducts.filter((p) => p.vendorId === v.id).length;

/** Units on hand per SKU for the demo catalog. */
export function demoStock(): Map<string, number> {
  const stock = new Map<string, number>();
  specs.forEach((spec, i) => {
    for (const variant of demoProducts[i].variants) {
      stock.set(variant.sku, spec.soldOut?.includes(variant.size) ? 0 : 12);
    }
  });
  return stock;
}

export const demoHome: HomeContent = {
  announcement: 'Complimentary delivery on every order',
  announcementSlides: [
    'Easy 14-day returns on every order',
    'Discover independent makers, all in one place',
  ],
  hero: {
    eyebrow: 'Autumn / Winter 2026',
    title: 'The Cold Season Edit',
    body: 'Overcoats, heavyweight knits and weatherproof boots from independent makers, for men and boys.',
    primary: { label: 'Shop men', href: '/shop/men' },
    secondary: { label: 'Shop boys', href: '/shop/boys' },
    image: {
      url: 'https://images.pexels.com/photos/30953652/pexels-photo-30953652.jpeg?auto=compress&cs=tinysrgb&w=2400',
      alt: 'Men in elegant attire indoors',
      tone: 'black',
    },
  },
  heroSlides: [
    {
      eyebrow: 'Made for every day',
      title: 'The Everyday Uniform',
      body: 'Contemporary menswear and considered layers, selected for everyday wear.',
      primary: { label: 'Shop men', href: '/shop/men' },
      secondary: { label: 'Discover brands', href: '/brands' },
      image: {
        url: 'https://images.pexels.com/photos/35121659/pexels-photo-35121659.jpeg?auto=compress&cs=tinysrgb&w=2400',
        alt: 'Stylish young man sitting on modern steps',
        tone: 'charcoal',
      },
    },
  ],
  departments: [
    { title: 'Men', body: 'Tailoring, outerwear and everyday essentials, built to last more than a season.', cta: { label: 'Shop men', href: '/shop/men' }, image: { url: '', alt: 'Men — layered tailoring', tone: 'charcoal' } },
    { title: 'Boys', body: 'Durable, washable pieces cut for growing up: from the playground to the weekend.', cta: { label: 'Shop boys', href: '/shop/boys' }, image: { url: '', alt: 'Boys — school-run layers', tone: 'stone' } },
  ],
  edit: {
    eyebrow: 'The shoe edit',
    title: 'From boardroom to back roads',
    body: 'Chelsea boots, suede loafers and weatherproof runners in sizes for men and boys, each chosen from makers who still resole what they sell.',
    cta: { label: 'Shop shoes', href: '/shop/men/shoes' },
    image: { url: '', alt: 'Footwear still life — boots on stone', tone: 'charcoal' },
    productIds: ['leather-chelsea-boot', 'suede-penny-loafer'],
  },
  newArrivalIds: [],
  updatedAt: T0,
};

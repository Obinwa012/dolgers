import type { Product } from './catalog';

/**
 * Preview data for local development only (DOLGERS_DEMO=1). It mirrors what the pipeline wrote for
 * the cargo pants we vetted by hand, so the pages can be designed against real content.
 */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'ae-1005012045737624',
    handle: 'mens-cargo-jogger-pants-3-pack',
    status: 'live',
    department: 'men',
    category: 'joggers',
    title: "Men's Cargo Jogger Pants, 3-Pack – Elastic Drawstring Waist",
    bullets: [
      '3 pairs: black, olive and khaki',
      'Elastic waist with drawstring; relaxed through the seat and thigh, tapered at the ankle',
      'Six pockets. The zippers on the side pockets are decorative',
      'Lightweight fabric',
      'Inseam about 29–30", shorter than standard US pants',
    ],
    description: [
      'Three everyday cargo joggers in one pack. The waist is fully elastic with a drawstring, so the fit is forgiving; the leg narrows to a gathered ankle.',
      'US buyers say they run slightly large. If you are between sizes, size down. If you are over 6 feet, expect them to sit above the ankle.',
    ],
    faq: [
      { q: 'Do they run large?', a: 'Slightly. US buyers recommend sizing down if you are between sizes.' },
      { q: "What's the inseam?", a: 'About 29–30 inches, depending on size. Over 6 feet tall, expect a cropped look.' },
      { q: 'Do the side zippers work?', a: 'No. The zippers on the side pockets are decorative.' },
      { q: 'How fast is delivery?', a: 'They ship from a US warehouse and arrive in about 6–10 days.' },
    ],
    seo: {
      title: "Men's Cargo Jogger Pants 3-Pack | Elastic Waist",
      metaDescription: 'Three relaxed cargo joggers in black, olive and khaki. Elastic drawstring waist, six pockets, ships from the US in 6–10 days.',
      primaryKeyword: "men's cargo jogger pants",
      secondaryKeywords: ['cargo joggers 3 pack'],
    },
    images: [
      { url: 'https://ae01.alicdn.com/kf/S784e94521b1949bc975040f4f0d6d80bi.jpg', alt: "Men's cargo jogger pants in black, olive and khaki, worn with white sneakers" },
      { url: 'https://ae01.alicdn.com/kf/S3a1b764f2de94066b9cf78089fb0701cW.jpg', alt: 'Olive cargo jogger pants, front view' },
      { url: 'https://ae01.alicdn.com/kf/S276767728bb2447196801abaa4ea8404H.jpg', alt: 'Khaki cargo jogger pants, front view' },
      { url: 'https://ae01.alicdn.com/kf/S541be280ca3a4fae860369691cc3bc27k.jpg', alt: 'Black cargo jogger pants, front view' },
    ],
    variants: ['S', 'M', 'L', 'XL', 'XXL'].map((size, i) => ({
      id: `1200005747458543${i + 1}`,
      color: '3-Pack: Black, Olive, Khaki',
      size,
      priceCents: size === 'XXL' ? 4499 : 4699,
      inStock: true,
    })),
    colors: ['3-Pack: Black, Olive, Khaki'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    priceFromCents: 4499,
    priceToCents: 4699,
    freeShipping: true,
    delivery: { minDays: 6, maxDays: 10 },
    material: null,
    origin: 'Imported',
    sizeChart: {
      fitType: 'Relaxed jogger, elastic drawstring waist',
      rows: [
        ['S', 28, 30, 40, 29.1, 42.5, 29.3],
        ['M', 31, 33, 42, 30.7, 44.1, 29.5],
        ['L', 34, 36, 44, 32.3, 46.1, 29.8],
        ['XL', 37, 39, 46, 33.9, 48, 30.2],
        ['XXL', 40, 42, 48, 35.4, 50, 30.5],
      ].map(([size, min, max, hipMax, waist, hip, inseam]) => ({
        size: String(size),
        fitsBody: [
          { measure: 'waist', min: Number(min), max: Number(max) },
          { measure: 'hips up to', min: Number(hipMax), max: Number(hipMax) },
        ],
        garment: { waist: Number(waist), hip: Number(hip), inseam: Number(inseam) },
        usSizeLabel: String(size),
        confidence: size === 'S' || size === 'XXL' ? 'low' : 'medium',
      })),
      fitNotes: ['Runs slightly large: size down if between sizes', 'Inseam is shorter than standard US pants; over 6 feet, expect a cropped look'],
    },
    publishedAt: 1791428400000,
  },
];

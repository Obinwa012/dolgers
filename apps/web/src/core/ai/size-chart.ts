import { z } from 'zod';
import { cmToIn } from '../util.ts';
import { type AiModels, type ImageInput, loadImage, type StructuredModel } from './claude.ts';


const ExtractSchema = z.strictObject({
  found: z.boolean(),
  imageIndex: z.number().nullable(),
  unit: z.enum(['cm', 'in']),
  measurementType: z.enum(['garment', 'body', 'unknown']),
  rows: z.array(
    z.strictObject({
      size: z.string(),
      measurements: z.array(z.strictObject({ name: z.string(), value: z.number() })),
    }),
  ),
  notes: z.string(),
});

export interface SellerSizeChart {
  found: boolean;
  source: string | null;
  measurementType: 'garment' | 'body' | 'unknown';
  /** Always inches. */
  rows: { size: string; measurements: Record<string, number> }[];
  notes: string;
}

const EXTRACT_SYSTEM = `You read a clothing seller's size chart from product images. Find the image that is a size chart (a table of sizes and measurements), and transcribe it exactly. Translate column names to English (e.g. 裤长=length, 腰围=waist, 臀围=hip, 内长=inseam, 胸围=chest, 衣长=length, 肩宽=shoulder, 袖长=sleeve). Do not convert units. Use the measurement name only, lower case ("waist", "hip", "inseam", "length", "chest", "shoulder", "sleeve"). If a value is a range, give the midpoint. measurementType: garment if the chart measures the item laid flat or "product size", body if it is for body measurements, else unknown. If no image is a size chart, found=false and rows=[].`;

export async function extractSellerSizeChart(
  model: StructuredModel,
  models: AiModels,
  imageUrls: string[],
  attributesSizeInfo: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<SellerSizeChart> {
  const loaded: { url: string; img: ImageInput }[] = [];
  for (const url of imageUrls.slice(0, 8)) {
    const img = await loadImage(url, fetchImpl);
    if (img) loaded.push({ url, img });
  }
  const parts = [
    { type: 'text' as const, text: `Images are numbered from 0 in order.${attributesSizeInfo ? `\nThe listing also carries this size data (field names may be wrong): ${attributesSizeInfo.slice(0, 1500)}` : ''}` },
    ...loaded.map((l) => ({ type: 'image' as const, image: l.img })),
  ];
  if (!loaded.length && !attributesSizeInfo) {
    return { found: false, source: null, measurementType: 'unknown', rows: [], notes: 'No description images' };
  }
  const out = await model.generate({ model: models.fast, system: EXTRACT_SYSTEM, parts, schema: ExtractSchema, maxTokens: 4000 });
  const toIn = (v: number) => (out.unit === 'cm' ? cmToIn(v) : Math.round(v * 10) / 10);
  return {
    found: out.found && out.rows.length > 0,
    source: out.imageIndex !== null ? loaded[out.imageIndex]?.url ?? null : attributesSizeInfo ? 'listing size data' : null,
    measurementType: out.measurementType,
    rows: out.rows.map((r) => ({
      size: r.size,
      measurements: Object.fromEntries(r.measurements.map((m) => [m.name.toLowerCase(), toIn(m.value)])),
    })),
    notes: out.notes,
  };
}

const GuideSchema = z.strictObject({
  fitType: z.string(),
  sizeNotes: z.array(z.strictObject({ size: z.string(), note: z.string() })),
  fitNotes: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * The size guide shoppers see: the supplier's own measurements (converted to inches), labelled as
 * such, with fit advice from US buyers. No generic US sizing is blended in as if it were measured.
 */
export interface SizeGuide {
  label: 'Supplier measurements';
  unit: 'in';
  /** Whether each figure measures the garment laid flat or the body it fits. */
  measurementType: 'garment' | 'body' | 'unknown';
  columns: string[];
  rows: { size: string; measurements: Record<string, number>; note: string | null }[];
  fitType: string;
  fitNotes: string[];
  basis: { usReviews: number };
  reasoning: string;
}
/** Older name, kept so earlier code and records still type-check. */
export type UsSizeChart = SizeGuide;

const GUIDE_SYSTEM = `You add fit advice to a clothing product's size chart. The measurements are the supplier's own and are not to be changed or invented. You get:
- the supplier's chart in inches, and whether it measures the garment or the body;
- US buyers' fit comments (size bought, runs large/small/true, which measurement, their height and weight when stated).
Rules:
- fitType: a few words on the cut ("Relaxed fit, elastic waist").
- sizeNotes: only for a size where two or more US buyers agree on the same direction ("Runs small: order one size up"). Otherwise leave that size out.
- fitNotes: short, honest lines for shoppers ("Runs slightly large: size down if between sizes", "Inseam about 29–30\": shorter than most US pants"), each supported by two or more US buyers or by the chart itself. No marketing language, no generic sizing advice.
- reasoning: one or two sentences on the evidence used.`;

export async function buildSizeGuide(
  model: StructuredModel,
  models: AiModels,
  input: {
    title: string;
    sizesSold: string[];
    seller: SellerSizeChart;
    usFit: { size: string | null; direction: string; dimension: string; heightIn: number | null; weightLb: number | null; quote: string }[];
  },
): Promise<SizeGuide | null> {
  if (!input.seller.found || !input.seller.rows.length) return null;
  const sold = new Set(input.sizesSold.map(normSize));
  const rows = input.seller.rows.filter((r) => !sold.size || sold.has(normSize(r.size)));
  if (!rows.length) return null;
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r.measurements)))];
  const out = await model.generate({
    model: models.careful,
    system: GUIDE_SYSTEM,
    parts: [
      {
        type: 'text',
        text: JSON.stringify({
          product: input.title,
          supplierChartInches: { measures: input.seller.measurementType, rows },
          usBuyerFitComments: input.usFit,
        }),
      },
    ],
    schema: GuideSchema,
    maxTokens: 3000,
  });
  const notes = new Map(out.sizeNotes.map((n) => [normSize(n.size), n.note]));
  return {
    label: 'Supplier measurements',
    unit: 'in',
    measurementType: input.seller.measurementType,
    columns,
    rows: rows.map((r) => ({ size: r.size, measurements: r.measurements, note: notes.get(normSize(r.size)) ?? null })),
    fitType: out.fitType,
    fitNotes: out.fitNotes,
    basis: { usReviews: input.usFit.length },
    reasoning: out.reasoning,
  };
}

/** "Men L", "XXL", "2XL" → comparable size labels. */
export function normSize(s: string): string {
  return s
    .toUpperCase()
    .replace(/^MEN'?S?\s+/, '')
    .replace(/\s+.*/, '')
    .replace(/^XXXXL$/, '4XL')
    .replace(/^XXXL$/, '3XL')
    .replace(/^XXL$/, '2XL')
    .trim();
}

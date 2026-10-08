import { z } from 'zod';
import { cmToIn } from '../util.ts';
import { type AiModels, type ImageInput, loadImage, type StructuredModel } from './claude.ts';

/**
 * US sizing references the size guide is checked against. These are approximate consensus
 * ranges across major US retailers (body measurements, inches); they guide the model, they are
 * not shown to customers as fact.
 */
export const US_REFERENCE = {
  menTops: { measure: 'chest', S: [35, 37], M: [38, 40], L: [41, 43], XL: [44, 46], XXL: [47, 49], '3XL': [50, 52] },
  menBottoms: { measure: 'waist', S: [28, 30], M: [31, 33], L: [34, 36], XL: [37, 39], XXL: [40, 42], '3XL': [43, 45] },
  womenTops: { measure: 'bust', XS: [32, 33], S: [34, 35], M: [36, 37], L: [38.5, 40], XL: [41.5, 43], XXL: [44.5, 46] },
  womenBottoms: { measure: 'waist', XS: [25, 26], S: [27, 28], M: [29, 30], L: [31.5, 33], XL: [34.5, 36], XXL: [37.5, 39] },
} as const;

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

const UsChartSchema = z.strictObject({
  fitType: z.string(),
  rows: z.array(
    z.strictObject({
      size: z.string(),
      fitsBody: z.array(z.strictObject({ measure: z.string(), min: z.number(), max: z.number() })),
      usSizeLabel: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
  fitNotes: z.array(z.string()),
  reasoning: z.string(),
});

export interface UsSizeChart {
  fitType: string;
  rows: {
    size: string;
    fitsBody: { measure: string; min: number; max: number }[];
    garment: Record<string, number>;
    usSizeLabel: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  fitNotes: string[];
  basis: { sellerChart: boolean; usReviews: number; reference: string };
  reasoning: string;
}

const US_SYSTEM = `You build a US size guide for one clothing product from three sources: the seller's chart (inches), US buyers' fit reviews, and US standard sizing. Rules:
- Body ranges must be consistent with the garment measurements: a garment must be larger than the body it fits by sensible ease (≈2-4" at hips/chest for regular fit; elastic waists stretch, so their unstretched waist is the low end of the body range).
- Only shift a size's guidance away from the seller chart and US standard when two or more US reviews agree on the direction. Otherwise keep it and mark confidence low or medium.
- fitNotes are short, honest lines for shoppers ("Runs slightly large: size down if between sizes", "Inseam about 29–30\\": shorter than standard US pants"). No marketing language.
- Use only the sizes the seller sells. confidence: high only with a seller chart AND consistent US review evidence for that size.`;

export async function buildUsSizeChart(
  model: StructuredModel,
  models: AiModels,
  input: {
    title: string;
    department: 'men' | 'women';
    kind: 'tops' | 'bottoms';
    sizesSold: string[];
    seller: SellerSizeChart;
    usFit: { size: string | null; direction: string; dimension: string; heightIn: number | null; weightLb: number | null; quote: string }[];
  },
): Promise<UsSizeChart> {
  const refKey = `${input.department}${input.kind === 'tops' ? 'Tops' : 'Bottoms'}` as keyof typeof US_REFERENCE;
  const out = await model.generate({
    model: models.careful,
    system: US_SYSTEM,
    parts: [
      {
        type: 'text',
        text: JSON.stringify({
          product: input.title,
          sizesSold: input.sizesSold,
          sellerChartInches: input.seller.found ? input.seller : 'none found',
          usBuyerFitEvidence: input.usFit,
          usStandardBodyMeasurements: US_REFERENCE[refKey],
        }),
      },
    ],
    schema: UsChartSchema,
    maxTokens: 6000,
  });
  const garmentBySize = new Map(input.seller.rows.map((r) => [normSize(r.size), r.measurements]));
  return {
    fitType: out.fitType,
    rows: out.rows.map((r) => ({ ...r, garment: garmentBySize.get(normSize(r.size)) ?? {} })),
    fitNotes: out.fitNotes,
    basis: { sellerChart: input.seller.found, usReviews: input.usFit.length, reference: refKey },
    reasoning: out.reasoning,
  };
}

function normSize(s: string): string {
  return s.toUpperCase().replace(/^MEN\s+|^WOMEN\s+/, '').replace('XXXL', '3XL').replace(/\s+.*/, '').trim();
}

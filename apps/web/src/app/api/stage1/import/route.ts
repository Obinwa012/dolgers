import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-auth';
import { aeFreightUS, aeTextSearch, getAeCreds, type FreightOption, type SearchProduct } from '@/lib/ae';
import { serverDb } from '@/lib/server/firebase-admin';

export const maxDuration = 300; // allow the freight-vetting loop to finish

const PAGE_SIZE = 20;
const FREIGHT_BATCH = 5;

interface StagedOut {
  aeProductId: string;
  title: string;
  image: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  rating: number | null;
  orders: number | null;
  freightOptions: FreightOption[];
  shipsFromUSA: boolean;
  stage1Status: 'passed' | 'failed';
  stage1Note: string;
}

async function vetOne(
  creds: NonNullable<Awaited<ReturnType<typeof getAeCreds>>>,
  p: SearchProduct,
): Promise<{ options: FreightOption[]; note: string }> {
  try {
    const options = await aeFreightUS(creds, p.productId);
    if (options.length === 0) return { options, note: 'No US freight option returned' };
    return { options, note: '' };
  } catch (e) {
    return { options: [], note: e instanceof Error ? e.message : 'Freight check failed' };
  }
}

/**
 * Stage 1: search a category (ship_from=US filter) then freight-vet every hit
 * with send_goods_country_code=US. Only products the freight API confirms are
 * staged as passed. Writes to `staging`, tracks the run in `jobs`.
 *
 * Body: { categoryId: string, keyword: string, page?: number }
 */
export async function POST(req: Request) {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const db = serverDb();
  if (!db) return NextResponse.json({ error: 'Database unavailable.' }, { status: 500 });

  let body: { categoryId?: string; keyword?: string; page?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const categoryId = (body.categoryId ?? '').trim();
  const keyword = (body.keyword ?? '').trim();
  const page = Math.max(1, Math.floor(body.page ?? 1));
  if (!categoryId || !keyword) {
    return NextResponse.json({ error: 'categoryId and keyword are required.' }, { status: 400 });
  }

  const creds = await getAeCreds();
  if (!creds?.appKey || !creds?.appSecret) {
    return NextResponse.json(
      { error: 'AliExpress not connected — add the app key + secret in Settings.', code: 'connect_ae' },
      { status: 400 },
    );
  }

  const jobRef = db.collection('jobs').doc();
  await jobRef.set({
    type: 'stage1-import',
    categoryId,
    keyword,
    page,
    status: 'running',
    vetted: 0,
    passed: 0,
    failed: 0,
    startedAt: Date.now(),
  });

  try {
    const { products, totalCount, debug } = await aeTextSearch(creds, {
      keyword,
      categoryId,
      pageIndex: page,
      pageSize: PAGE_SIZE,
    });

    let vetted = 0;
    let passed = 0;
    let failed = 0;
    const out: StagedOut[] = [];

    for (let i = 0; i < products.length; i += FREIGHT_BATCH) {
      const batch = products.slice(i, i + FREIGHT_BATCH);
      const results = await Promise.all(batch.map((p) => vetOne(creds, p)));
      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const { options, note } = results[j];
        vetted++;
        const ships = options.length > 0;
        if (ships) passed++;
        else failed++;
        const staged: StagedOut = {
          aeProductId: p.productId,
          title: p.title,
          image: p.image,
          priceMin: p.priceMin,
          priceMax: p.priceMax,
          currency: p.currency,
          rating: p.rating,
          orders: p.orders,
          freightOptions: options,
          shipsFromUSA: ships,
          stage1Status: ships ? 'passed' : 'failed',
          stage1Note: ships ? '' : note,
        };
        await db.collection('staging').doc(p.productId).set(
          {
            ...staged,
            categoryId,
            keyword,
            stage: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
        out.push(staged);
      }
      await jobRef.update({ vetted, passed, failed });
    }

    await jobRef.update({
      status: 'done',
      vetted,
      passed,
      failed,
      totalCount,
      finishedAt: Date.now(),
    });
    return NextResponse.json({ ok: true, vetted, passed, failed, totalCount, products: out, debug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed.';
    await jobRef.update({ status: 'error', error: msg, finishedAt: Date.now() });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import type { CandidateDoc, ProductDoc } from '@/core/firestore/model.ts';
import { pauseSellerProducts, repriceVariants } from '@/core/stages.ts';
import { adminOrThrow } from '../auth.ts';
import { db, repo } from '../firebase.ts';
import { fail, type Result } from './result.ts';

export type ProductAction = 'approve' | 'pause' | 'retire' | 'reprice' | 'requeue' | 'delete';

export async function productAction(id: string, action: ProductAction): Promise<Result<{ subId?: string }>> {
  try {
    const me = await adminOrThrow();
    const r = repo();
    const p = await r.getProduct(id);
    if (!p) return { ok: false, error: 'Product not found' };
    const src = await r.getSourcing(id);
    const now = Date.now();
    switch (action) {
      case 'approve': {
        if (!p.variants.length || !p.variants.some((v) => v.inStock)) return { ok: false, error: 'No variant is in stock, so it can’t go live.' };
        if (p.variants.some((v) => !(v.priceCents > 0))) return { ok: false, error: 'Some variants have no price. Reprice first.' };
        await r.updateProduct(id, { status: 'live', holdReasons: [], publishedAt: p.publishedAt ?? now, updatedAt: now });
        if (src) await r.updateCandidate(src.aeSubId, { status: 'published', reasons: [`Approved by ${me.email}`] }).catch(() => {});
        break;
      }
      case 'pause':
        await r.updateProduct(id, { status: 'paused', holdReasons: [`Paused by ${me.email}`], updatedAt: now });
        break;
      case 'retire':
        await r.updateProduct(id, { status: 'retired', updatedAt: now });
        break;
      case 'reprice': {
        if (!src) return { ok: false, error: 'No sourcing record for this product.' };
        const config = await r.loadConfig();
        const next = repriceVariants(p, src, config.pricing);
        await r.updateProduct(id, { variants: next.variants, priceFromCents: next.priceFromCents, priceToCents: next.priceToCents, updatedAt: now });
        await r.updateSourcing(id, { skus: next.skus, updatedAt: now });
        break;
      }
      case 'requeue': {
        if (!src) return { ok: false, error: 'No sourcing record for this product.' };
        const existing = await r.getCandidate(src.aeSubId);
        await r.deleteWork(src.aeSubId); // start from scratch, not from a half-finished earlier vet
        if (existing) {
          await r.updateCandidate(src.aeSubId, { status: 'new', nextCheckAt: null, attempts: 0, reasons: ['Re-vet requested'], updatedAt: now });
        } else {
          const c: CandidateDoc = {
            subId: src.aeSubId, mainId: src.aeMainId, feeds: src.feeds, title: p.title, department: 'men',
            categoryId: null, subcategoryName: null, shopId: src.storeId, recentSales: 0, feedPriceCents: null,
            status: 'new', reasons: ['Re-vet requested'], nextCheckAt: null, attempts: 0, createdAt: now, updatedAt: now,
          };
          await r.upsertCandidates([c]);
        }
        revalidatePath('/products');
        return { ok: true, subId: src.aeSubId };
      }
      case 'delete': {
        if (p.status !== 'retired') return { ok: false, error: 'Retire the product before deleting it.' };
        const batch = db().batch();
        for (const col of ['products', 'sourcing', 'vetting']) batch.delete(db().collection(col).doc(id));
        await batch.commit();
        break;
      }
    }
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export interface CopyEdit {
  title: string;
  bullets: string[];
  description: string[];
  seoTitle: string;
  metaDescription: string;
  faq: { q: string; a: string }[];
}

export async function saveProductCopy(id: string, edit: CopyEdit): Promise<Result> {
  try {
    await adminOrThrow();
    const p = await repo().getProduct(id);
    if (!p) return { ok: false, error: 'Product not found' };
    const title = edit.title.trim();
    if (!title) return { ok: false, error: 'The title can’t be empty.' };
    if (title.length > 120) return { ok: false, error: 'Keep the title under 120 characters.' };
    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
    const patch: Partial<ProductDoc> = {
      title,
      bullets: clean(edit.bullets),
      description: clean(edit.description),
      faq: edit.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a),
      seo: { ...p.seo, title: edit.seoTitle.trim().slice(0, 70), metaDescription: edit.metaDescription.trim().slice(0, 170) },
      updatedAt: Date.now(),
    };
    await repo().updateProduct(id, patch);
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function candidateAction(subId: string, action: 'requeue' | 'skip'): Promise<Result> {
  try {
    const me = await adminOrThrow();
    const c = await repo().getCandidate(subId);
    if (!c) return { ok: false, error: 'Not in the queue' };
    if (c.status === 'vetting') {
      if ((await repo().listJobs(20)).some((j) => j.status === 'running' && j.type === 'vet')) {
        return { ok: false, error: 'A vet job is running and may be working on this item. Stop it first.' };
      }
      await repo().deleteWork(subId);
    }
    const now = Date.now();
    if (action === 'requeue') {
      await repo().updateCandidate(subId, { status: 'new', nextCheckAt: null, attempts: 0, reasons: [], updatedAt: now });
    } else {
      await repo().updateCandidate(subId, { status: 'rejected', nextCheckAt: null, reasons: [`Skipped by ${me.email}`], updatedAt: now });
    }
    revalidatePath('/queue');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function sellerAction(storeId: string, action: 'block' | 'unblock'): Promise<Result<{ paused?: number }>> {
  try {
    const me = await adminOrThrow();
    const s = await repo().getSeller(storeId);
    if (!s) return { ok: false, error: 'Seller not found' };
    if (action === 'unblock') {
      await repo().saveSeller({ ...s, blocked: false, blockReasons: [], updatedAt: Date.now() });
    } else {
      const reasons = [`Blocked by ${me.email}`];
      await repo().saveSeller({ ...s, blocked: true, blockReasons: reasons, updatedAt: Date.now() });
      const before = await repo().productIdsByStore(storeId);
      await pauseSellerProducts({ repo: repo(), log: () => {} }, storeId, reasons);
      revalidatePath('/sellers');
      return { ok: true, paused: before.length };
    }
    revalidatePath('/sellers');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

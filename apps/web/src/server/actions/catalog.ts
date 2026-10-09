'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import type { CandidateDoc, CandidateStatus, DeletionDoc, ProductDoc, QualityEvent } from '@/core/firestore/model.ts';
import { applyQualityEvent } from '@/core/quality.ts';
import { ISSUE_RULES, type IssueCategory } from '@/core/vetting/issues.ts';
import { CLEARED_CHECKS, pauseSellerProducts, repriceVariants } from '@/core/stages.ts';
import { adminOrThrow } from '../auth.ts';
import { db, repo } from '../firebase.ts';
import { fail, type Result } from './result.ts';

export type ProductAction = 'approve' | 'pause' | 'retire' | 'reprice' | 'requeue';

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
        if (p.status !== 'pending_review' && p.status !== 'paused') return { ok: false, error: `A ${p.status} product can’t be published from here.` };
        if (!p.variants.length || !p.variants.some((v) => v.inStock)) return { ok: false, error: 'No variant is in stock, so it can’t go live.' };
        if (p.variants.some((v) => !(v.priceCents > 0))) return { ok: false, error: 'Some variants have no price. Reprice first.' };
        const rc = p.review;
        if (!rc?.reverseImage || !rc.noBrandResemblance || !rc.listingRead) {
          return { ok: false, error: 'Tick all three checks before publishing.' };
        }
        await r.updateProduct(id, { status: 'live', holdReasons: [], publishedAt: p.publishedAt ?? now, updatedAt: now });
        if (src) await r.updateCandidate(src.aeSubId, { status: 'published', reasons: [`Approved by ${me.email}`] }).catch(() => {});
        break;
      }
      case 'pause':
        await r.updateProduct(id, { status: 'paused', holdReasons: [`Paused by ${me.email}`], review: CLEARED_CHECKS, updatedAt: now });
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
    }
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type CheckKey = 'reverseImage' | 'noBrandResemblance' | 'listingRead';

/** One of the three checks you tick on the review page before the publish button unlocks. */
export async function setReviewCheck(id: string, key: CheckKey, value: boolean): Promise<Result> {
  try {
    const me = await adminOrThrow();
    const p = await repo().getProduct(id);
    if (!p) return { ok: false, error: 'Product not found' };
    const review = { reverseImage: false, noBrandResemblance: false, listingRead: false, ...(p.review ?? {}), [key]: value, by: me.email, at: Date.now() };
    await repo().updateProduct(id, { review });
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}


/** Deletes a product at review and records why, so recurring reasons can become rules. */
export async function deleteProduct(id: string, reason: string, note: string): Promise<Result> {
  try {
    const me = await adminOrThrow();
    if (!reason.trim()) return { ok: false, error: 'Choose a reason.' };
    if (reason === 'Other' && !note.trim()) return { ok: false, error: 'Say why in the note.' };
    const r = repo();
    const p = await r.getProduct(id);
    if (!p) return { ok: false, error: 'Product not found' };
    const src = await r.getSourcing(id);
    const now = Date.now();
    const deletion: DeletionDoc = {
      id: `${now}-${id}`,
      productId: id,
      title: p.title,
      reason: reason.trim().slice(0, 200),
      note: note.trim().slice(0, 1000),
      decision: p.decision,
      storeId: src?.storeId ?? null,
      aeSubId: src?.aeSubId ?? null,
      by: me.email,
      at: now,
    };
    const batch = db().batch();
    batch.set(db().collection('deletions').doc(deletion.id), deletion);
    for (const col of ['products', 'sourcing', 'vetting']) batch.delete(db().collection(col).doc(id));
    await batch.commit();
    // Never re-import it.
    if (src) await r.updateCandidate(src.aeSubId, { status: 'rejected', nextCheckAt: null, reasons: [`Deleted at review: ${deletion.reason}${deletion.note ? ` (${deletion.note})` : ''}`] });
    revalidatePath('/products');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export interface QualityInput {
  kind: QualityEvent['kind'];
  count: number;
  category: string | null;
  note: string;
}

/** Records your own orders, refunds, complaints and disputes against a product, and applies the rules. */
export async function recordQuality(id: string, input: QualityInput): Promise<Result<{ notes: string[] }>> {
  try {
    const me = await adminOrThrow();
    const r = repo();
    const p = await r.getProduct(id);
    if (!p) return { ok: false, error: 'Product not found' };
    if (input.kind === 'complaint' && !input.category) return { ok: false, error: 'Choose what the complaint was about.' };
    const config = await r.loadConfig();
    const category = input.category && input.category in ISSUE_RULES ? (input.category as IssueCategory) : null;
    const ev: QualityEvent = {
      at: Date.now(),
      kind: input.kind,
      count: Math.max(1, Math.min(10_000, Math.round(input.count) || 1)),
      category,
      bucket: category ? ISSUE_RULES[category].bucket : null,
      note: input.note.trim().slice(0, 500),
      by: me.email,
    };
    const { patch, notes } = applyQualityEvent(p, ev, config);
    await r.updateProduct(id, patch);
    revalidatePath(`/products/${id}`);
    return { ok: true, notes };
  } catch (e) {
    return fail(e);
  }
}

export async function clearFlags(id: string): Promise<Result> {
  try {
    await adminOrThrow();
    await repo().updateProduct(id, { flags: [] });
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

export type BulkAction = 'delete' | 'skip' | 'requeue';

async function vetJobRunning() {
  return (await repo().listJobs(20)).some((j) => j.status === 'running' && j.type === 'vet');
}

/**
 * Applies one action to many queue items. Delete removes them (a later import can add them back);
 * Skip keeps a record so they are never vetted or re-imported; Requeue puts them back in line.
 */
async function applyBulk(action: BulkAction, items: CandidateDoc[], who: string, vetRunning: boolean) {
  const now = Date.now();
  let done = 0;
  let skipped = 0;
  const batchSize = 400;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = db().batch();
    const vetting: string[] = [];
    for (const c of items.slice(i, i + batchSize)) {
      // An item a running vet job may be working on is left alone.
      if (c.status === 'vetting' && vetRunning) {
        skipped++;
        continue;
      }
      if (c.status === 'published' && action !== 'delete') {
        skipped++;
        continue;
      }
      const ref = db().collection('candidates').doc(c.subId);
      if (action === 'delete') batch.delete(ref);
      else if (action === 'skip') {
        batch.set(ref, { status: 'rejected', nextCheckAt: null, reasons: [`Skipped by ${who}`], queueSales: FieldValue.delete(), updatedAt: now }, { merge: true });
      } else {
        batch.set(ref, { status: 'new', nextCheckAt: null, attempts: 0, reasons: [], queueSales: c.recentSales ?? 0, updatedAt: now }, { merge: true });
      }
      if (c.status === 'vetting') vetting.push(c.subId);
      done++;
    }
    await batch.commit();
    for (const id of vetting) await repo().deleteWork(id);
  }
  return { done, skipped };
}

export async function bulkCandidates(action: BulkAction, subIds: string[]): Promise<Result<{ done: number; skipped: number }>> {
  try {
    const me = await adminOrThrow();
    const ids = [...new Set(subIds)].slice(0, 1000);
    if (!ids.length) return { ok: false, error: 'Nothing selected.' };
    const snaps = await db().getAll(...ids.map((id) => db().collection('candidates').doc(id)));
    const items = snaps.filter((s) => s.exists).map((s) => s.data() as CandidateDoc);
    const r = await applyBulk(action, items, me.email, await vetJobRunning());
    revalidatePath('/queue');
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

/** One chunk of "all items in this tab". The page calls it until nothing is left. */
export async function bulkCandidatesByStatus(
  action: BulkAction,
  status: CandidateStatus,
): Promise<Result<{ done: number; skipped: number; remaining: number }>> {
  try {
    const me = await adminOrThrow();
    if (action === 'requeue' && status === 'new') return { ok: false, error: 'These are already waiting.' };
    if (action === 'skip' && status === 'rejected') return { ok: false, error: 'These are already skipped or rejected.' };
    const vetRunning = await vetJobRunning();
    if (status === 'vetting' && vetRunning) return { ok: false, error: 'A vet job is running. Stop it first.' };
    const snap = await db().collection('candidates').where('status', '==', status).limit(1000).get();
    const items = snap.docs.map((d) => d.data() as CandidateDoc);
    const r = await applyBulk(action, items, me.email, vetRunning);
    const remaining = (await db().collection('candidates').where('status', '==', status).count().get()).data().count;
    revalidatePath('/queue');
    // Items that were left alone stay in the tab; don't loop on them forever.
    return { ok: true, ...r, remaining: r.done ? remaining : 0 };
  } catch (e) {
    return fail(e);
  }
}

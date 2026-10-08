import { type App, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, type Firestore, getFirestore } from 'firebase-admin/firestore';
import type { AeTokens, TokenStore } from '../aliexpress/client.ts';
import type { Review } from '../types.ts';
import { mergeConfig, type VettingConfig } from '../vetting/config.ts';
import type {
  CandidateDoc,
  CandidateStatus,
  JobDoc,
  PipelineSettings,
  ProductDoc,
  SecretsDoc,
  SellerDoc,
  SourcingDoc,
  VettingDoc,
  WorkState,
} from './model.ts';

/** Everything the pipeline reads and writes. Firestore in production; memory in tests. */
export interface Repo {
  loadConfig(): Promise<VettingConfig>;
  settings(): Promise<PipelineSettings>;
  saveSettings(patch: PipelineSettings): Promise<void>;
  secrets(): Promise<SecretsDoc>;
  saveSecrets(patch: SecretsDoc): Promise<void>;
  tokenStore(): TokenStore;

  upsertCandidates(items: CandidateDoc[]): Promise<{ added: number; updated: number }>;
  /** New candidates by recent sales, then rechecks whose date has come. */
  dueCandidates(limit: number, now: number): Promise<CandidateDoc[]>;
  getCandidate(subId: string): Promise<CandidateDoc | null>;
  listCandidates(status: CandidateStatus | null, limit: number): Promise<CandidateDoc[]>;
  updateCandidate(subId: string, patch: Partial<CandidateDoc>): Promise<void>;

  getProduct(id: string): Promise<ProductDoc | null>;
  listProducts(statuses: ProductDoc['status'][]): Promise<ProductDoc[]>;
  saveProduct(p: ProductDoc, sourcing: SourcingDoc, vetting: VettingDoc): Promise<void>;
  updateProduct(id: string, patch: Partial<ProductDoc>): Promise<void>;
  getSourcing(id: string): Promise<SourcingDoc | null>;
  productIdsByStore(storeId: string): Promise<string[]>;
  updateSourcing(id: string, patch: Partial<SourcingDoc>): Promise<void>;
  getVetting(id: string): Promise<VettingDoc | null>;
  saveVetting(v: VettingDoc): Promise<void>;

  getSeller(storeId: string): Promise<SellerDoc | null>;
  listSellers(limit: number): Promise<SellerDoc[]>;
  blockedSellers(): Promise<SellerDoc[]>;
  saveSeller(s: SellerDoc): Promise<void>;

  getWork(subId: string): Promise<WorkState | null>;
  /** Unfinished vetting left by a stopped job, oldest first. */
  listWork(limit: number): Promise<WorkState[]>;
  saveWork(w: WorkState): Promise<void>;
  deleteWork(subId: string): Promise<void>;
  getWorkReviews(subId: string): Promise<Review[]>;
  appendWorkReviews(subId: string, reviews: Review[]): Promise<void>;

  createJob(j: JobDoc): Promise<void>;
  getJob(id: string): Promise<JobDoc | null>;
  listJobs(limit: number): Promise<JobDoc[]>;
  updateJob(id: string, patch: Partial<JobDoc>): Promise<void>;
  /** Takes the job's lock for `ms` unless another request holds it; returns the job as locked. */
  lockJob(id: string, ms: number, now: number): Promise<JobDoc | null>;
}

export function initAdmin(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    (process.env.FIREBASE_CONFIG ? (JSON.parse(process.env.FIREBASE_CONFIG).projectId as string) : undefined);
  return initializeApp(projectId ? { projectId } : undefined);
}

export function adminDb(): Firestore {
  const db = getFirestore(initAdmin());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* already configured */
  }
  return db;
}

const RECHECK: CandidateStatus[] = ['screened_out', 'insufficient_data', 'error'];
/** A candidate that errors this many times stops being retried. */
export const MAX_ATTEMPTS = 5;
/** Firestore documents max out at 1 MiB; reviews are stored in chunks well below that. */
const REVIEW_CHUNK = 300;

/** A request cut off mid-way can store a review page twice; keep each review once. */
function firstOfEachId() {
  const seen = new Set<string>();
  return (r: Review) => (seen.has(r.id) ? false : (seen.add(r.id), true));
}

function tokensFrom(s: SecretsDoc): AeTokens | null {
  return s.aeAccessToken
    ? {
        accessToken: s.aeAccessToken,
        refreshToken: s.aeRefreshToken ?? null,
        expiresAt: s.aeExpiresAt ?? 0,
        refreshExpiresAt: s.aeRefreshExpiresAt ?? null,
      }
    : null;
}

function tokensTo(t: AeTokens): SecretsDoc {
  return {
    aeAccessToken: t.accessToken,
    aeRefreshToken: t.refreshToken,
    aeExpiresAt: t.expiresAt,
    aeRefreshExpiresAt: t.refreshExpiresAt,
  };
}

/**
 * Picks due candidates without composite indexes (none need deploying): new ones by recent sales,
 * then rechecks whose date has come.
 */
function pickDue(fresh: CandidateDoc[], rechecks: CandidateDoc[], limit: number, now: number): CandidateDoc[] {
  const a = fresh.filter((c) => c.status === 'new').sort((x, y) => y.recentSales - x.recentSales);
  const b = rechecks
    .filter((c) => RECHECK.includes(c.status) && c.nextCheckAt !== null && c.nextCheckAt <= now)
    .filter((c) => c.status !== 'error' || c.attempts < MAX_ATTEMPTS)
    .sort((x, y) => x.nextCheckAt! - y.nextCheckAt!);
  return [...a, ...b].slice(0, limit);
}

export class FirestoreRepo implements Repo {
  constructor(private readonly db: Firestore = adminDb()) {}

  private secretsRef() {
    return this.db.doc('config/secrets');
  }

  async loadConfig() {
    return mergeConfig((await this.settings()).vetting);
  }
  async settings() {
    return ((await this.db.doc('config/pipeline').get()).data() as PipelineSettings | undefined) ?? {};
  }
  async saveSettings(patch: PipelineSettings) {
    await this.db.doc('config/pipeline').set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }
  async secrets() {
    return ((await this.secretsRef().get()).data() as SecretsDoc | undefined) ?? {};
  }
  async saveSecrets(patch: SecretsDoc) {
    await this.secretsRef().set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }
  tokenStore(): TokenStore {
    return {
      load: async () => tokensFrom(await this.secrets()),
      save: async (t) => this.saveSecrets(tokensTo(t)),
    };
  }

  async upsertCandidates(items: CandidateDoc[]) {
    let added = 0;
    let updated = 0;
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200);
      const refs = chunk.map((c) => this.db.collection('candidates').doc(c.subId));
      const snaps = await this.db.getAll(...refs);
      const batch = this.db.batch();
      snaps.forEach((snap, j) => {
        const c = chunk[j]!;
        if (!snap.exists) {
          batch.set(refs[j]!, { ...c, queueSales: c.status === 'new' ? c.recentSales : undefined });
          added++;
        } else {
          const waiting = (snap.data() as CandidateDoc).status === 'new';
          batch.update(refs[j]!, {
            feeds: FieldValue.arrayUnion(...c.feeds),
            recentSales: c.recentSales,
            feedPriceCents: c.feedPriceCents,
            updatedAt: c.updatedAt,
            ...(waiting ? { queueSales: c.recentSales } : {}),
          });
          updated++;
        }
      });
      await batch.commit();
    }
    return { added, updated };
  }
  async dueCandidates(limit: number, now: number) {
    // queueSales exists only on waiting candidates, so ordering by it (a single-field index, no
    // composite index to deploy) reads just the best sellers instead of the whole queue.
    const col = this.db.collection('candidates');
    let fresh = (await col.orderBy('queueSales', 'desc').limit(limit).get()).docs.map((d) => d.data() as CandidateDoc);
    if (fresh.length < limit) {
      // Candidates saved before queueSales existed.
      fresh = fresh.concat((await col.where('status', '==', 'new').limit(limit).get()).docs.map((d) => d.data() as CandidateDoc));
    }
    const again = await col.where('nextCheckAt', '<=', now).orderBy('nextCheckAt').limit(200).get();
    const seen = new Set<string>();
    fresh = fresh.filter((c) => !seen.has(c.subId) && seen.add(c.subId));
    return pickDue(fresh, again.docs.map((d) => d.data() as CandidateDoc), limit, now);
  }
  async getCandidate(subId: string) {
    return ((await this.db.collection('candidates').doc(subId).get()).data() as CandidateDoc | undefined) ?? null;
  }
  async listCandidates(status: CandidateStatus | null, limit: number) {
    const q = status
      ? this.db.collection('candidates').where('status', '==', status).limit(limit)
      : this.db.collection('candidates').orderBy('updatedAt', 'desc').limit(limit);
    const docs = (await q.get()).docs.map((d) => d.data() as CandidateDoc);
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async updateCandidate(subId: string, patch: Partial<CandidateDoc>) {
    const ref = this.db.collection('candidates').doc(subId);
    let queue: Record<string, unknown> = {};
    if (patch.status === 'new') {
      const sales = patch.recentSales ?? ((await ref.get()).data() as CandidateDoc | undefined)?.recentSales ?? 0;
      queue = { queueSales: sales };
    } else if (patch.status) {
      queue = { queueSales: FieldValue.delete() };
    }
    await ref.set({ ...patch, ...queue, updatedAt: Date.now() }, { merge: true });
  }

  async getProduct(id: string) {
    return ((await this.db.collection('products').doc(id).get()).data() as ProductDoc | undefined) ?? null;
  }
  async listProducts(statuses: ProductDoc['status'][]) {
    const snap = await this.db.collection('products').where('status', 'in', statuses).get();
    return snap.docs.map((d) => d.data() as ProductDoc).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async saveProduct(p: ProductDoc, s: SourcingDoc, v: VettingDoc) {
    const batch = this.db.batch();
    batch.set(this.db.collection('products').doc(p.id), p);
    batch.set(this.db.collection('sourcing').doc(p.id), s);
    batch.set(this.db.collection('vetting').doc(p.id), v);
    await batch.commit();
  }
  async updateProduct(id: string, patch: Partial<ProductDoc>) {
    await this.db.collection('products').doc(id).update({ ...patch, updatedAt: Date.now() });
  }
  async getSourcing(id: string) {
    return ((await this.db.collection('sourcing').doc(id).get()).data() as SourcingDoc | undefined) ?? null;
  }
  async productIdsByStore(storeId: string) {
    return (await this.db.collection('sourcing').where('storeId', '==', storeId).get()).docs.map((d) => d.id);
  }
  async updateSourcing(id: string, patch: Partial<SourcingDoc>) {
    await this.db.collection('sourcing').doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }
  async getVetting(id: string) {
    return ((await this.db.collection('vetting').doc(id).get()).data() as VettingDoc | undefined) ?? null;
  }
  async saveVetting(v: VettingDoc) {
    await this.db.collection('vetting').doc(v.productId).set(v);
  }

  async getSeller(storeId: string) {
    return ((await this.db.collection('sellers').doc(storeId).get()).data() as SellerDoc | undefined) ?? null;
  }
  async listSellers(limit: number) {
    const snap = await this.db.collection('sellers').orderBy('updatedAt', 'desc').limit(limit).get();
    return snap.docs.map((d) => d.data() as SellerDoc);
  }
  async blockedSellers() {
    return (await this.db.collection('sellers').where('blocked', '==', true).get()).docs.map((d) => d.data() as SellerDoc);
  }
  async saveSeller(s: SellerDoc) {
    await this.db.collection('sellers').doc(s.storeId).set(s);
  }

  async getWork(subId: string) {
    return ((await this.db.collection('work').doc(subId).get()).data() as WorkState | undefined) ?? null;
  }
  async listWork(limit: number) {
    return (await this.db.collection('work').orderBy('updatedAt').limit(limit).get()).docs.map((d) => d.data() as WorkState);
  }
  async saveWork(w: WorkState) {
    await this.db.collection('work').doc(w.subId).set(w);
  }
  async deleteWork(subId: string) {
    const parts = await this.db.collection('work').doc(subId).collection('parts').listDocuments();
    const batch = this.db.batch();
    parts.forEach((p) => batch.delete(p));
    batch.delete(this.db.collection('work').doc(subId));
    await batch.commit();
  }
  async getWorkReviews(subId: string) {
    const snap = await this.db.collection('work').doc(subId).collection('parts').get();
    return snap.docs
      .filter((d) => d.id.startsWith('reviews-'))
      .sort((a, b) => Number(a.id.slice(8)) - Number(b.id.slice(8)))
      .flatMap((d) => (d.data().reviews as Review[]) ?? [])
      .filter(firstOfEachId());
  }
  async appendWorkReviews(subId: string, reviews: Review[]) {
    const parts = this.db.collection('work').doc(subId).collection('parts');
    const existing = (await parts.listDocuments()).filter((d) => d.id.startsWith('reviews-')).length;
    for (let i = 0; i < reviews.length; i += REVIEW_CHUNK) {
      await parts.doc(`reviews-${existing + i / REVIEW_CHUNK}`).set({ reviews: reviews.slice(i, i + REVIEW_CHUNK) });
    }
  }

  async createJob(j: JobDoc) {
    await this.db.collection('jobs').doc(j.id).set(j);
  }
  async getJob(id: string) {
    return ((await this.db.collection('jobs').doc(id).get()).data() as JobDoc | undefined) ?? null;
  }
  async listJobs(limit: number) {
    return (await this.db.collection('jobs').orderBy('createdAt', 'desc').limit(limit).get()).docs.map((d) => d.data() as JobDoc);
  }
  async updateJob(id: string, patch: Partial<JobDoc>) {
    await this.db.collection('jobs').doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }
  async lockJob(id: string, ms: number, now: number) {
    const ref = this.db.collection('jobs').doc(id);
    return this.db.runTransaction(async (tx) => {
      const j = (await tx.get(ref)).data() as JobDoc | undefined;
      if (!j || j.lockedUntil > now) return null;
      tx.update(ref, { lockedUntil: now + ms });
      return { ...j, lockedUntil: now + ms };
    });
  }
}

/** In-memory repo for tests. */
export class MemoryRepo implements Repo {
  settingsDoc: PipelineSettings = {};
  secretsDoc: SecretsDoc = {};
  candidates = new Map<string, CandidateDoc>();
  products = new Map<string, ProductDoc>();
  sourcing = new Map<string, SourcingDoc>();
  vetting = new Map<string, VettingDoc>();
  sellers = new Map<string, SellerDoc>();
  work = new Map<string, WorkState>();
  workReviews = new Map<string, Review[]>();
  jobs = new Map<string, JobDoc>();

  async loadConfig() {
    return mergeConfig(this.settingsDoc.vetting);
  }
  async settings() {
    return structuredClone(this.settingsDoc);
  }
  async saveSettings(patch: PipelineSettings) {
    this.settingsDoc = { ...this.settingsDoc, ...patch };
  }
  async secrets() {
    return { ...this.secretsDoc };
  }
  async saveSecrets(patch: SecretsDoc) {
    this.secretsDoc = { ...this.secretsDoc, ...patch };
  }
  tokenStore(): TokenStore {
    return { load: async () => tokensFrom(this.secretsDoc), save: async (t) => this.saveSecrets(tokensTo(t)) };
  }
  async upsertCandidates(items: CandidateDoc[]) {
    let added = 0;
    let updated = 0;
    for (const c of items) {
      const prev = this.candidates.get(c.subId);
      if (prev) {
        this.candidates.set(c.subId, { ...prev, feeds: [...new Set([...prev.feeds, ...c.feeds])], recentSales: c.recentSales, updatedAt: c.updatedAt });
        updated++;
      } else {
        this.candidates.set(c.subId, c);
        added++;
      }
    }
    return { added, updated };
  }
  async dueCandidates(limit: number, now: number) {
    const all = [...this.candidates.values()];
    return pickDue(all, all, limit, now);
  }
  async getCandidate(subId: string) {
    return this.candidates.get(subId) ?? null;
  }
  async listCandidates(status: CandidateStatus | null, limit: number) {
    return [...this.candidates.values()].filter((c) => !status || c.status === status).slice(0, limit);
  }
  async updateCandidate(subId: string, patch: Partial<CandidateDoc>) {
    const prev = this.candidates.get(subId);
    if (prev) this.candidates.set(subId, { ...prev, ...patch, updatedAt: Date.now() });
  }
  async getProduct(id: string) {
    return this.products.get(id) ?? null;
  }
  async listProducts(statuses: ProductDoc['status'][]) {
    return [...this.products.values()].filter((p) => statuses.includes(p.status));
  }
  async saveProduct(p: ProductDoc, s: SourcingDoc, v: VettingDoc) {
    this.products.set(p.id, structuredClone(p));
    this.sourcing.set(p.id, structuredClone(s));
    this.vetting.set(p.id, structuredClone(v));
  }
  async updateProduct(id: string, patch: Partial<ProductDoc>) {
    const prev = this.products.get(id);
    if (prev) this.products.set(id, { ...prev, ...patch, updatedAt: Date.now() });
  }
  async getSourcing(id: string) {
    return this.sourcing.get(id) ?? null;
  }
  async productIdsByStore(storeId: string) {
    return [...this.sourcing.values()].filter((s) => s.storeId === storeId).map((s) => s.productId);
  }
  async updateSourcing(id: string, patch: Partial<SourcingDoc>) {
    const prev = this.sourcing.get(id);
    if (prev) this.sourcing.set(id, { ...prev, ...patch, updatedAt: Date.now() });
  }
  async getVetting(id: string) {
    return this.vetting.get(id) ?? null;
  }
  async saveVetting(v: VettingDoc) {
    this.vetting.set(v.productId, structuredClone(v));
  }
  async getSeller(storeId: string) {
    return this.sellers.get(storeId) ?? null;
  }
  async listSellers(limit: number) {
    return [...this.sellers.values()].slice(0, limit);
  }
  async blockedSellers() {
    return [...this.sellers.values()].filter((s) => s.blocked);
  }
  async saveSeller(s: SellerDoc) {
    this.sellers.set(s.storeId, structuredClone(s));
  }
  async getWork(subId: string) {
    const w = this.work.get(subId);
    return w ? structuredClone(w) : null;
  }
  async listWork(limit: number) {
    return [...this.work.values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(0, limit).map((w) => structuredClone(w));
  }
  async saveWork(w: WorkState) {
    // Round-trip through JSON like Firestore would, so tests catch non-serializable state.
    this.work.set(w.subId, JSON.parse(JSON.stringify(w)));
  }
  async deleteWork(subId: string) {
    this.work.delete(subId);
    this.workReviews.delete(subId);
  }
  async getWorkReviews(subId: string) {
    return structuredClone(this.workReviews.get(subId) ?? []).filter(firstOfEachId());
  }
  async appendWorkReviews(subId: string, reviews: Review[]) {
    this.workReviews.set(subId, [...(this.workReviews.get(subId) ?? []), ...structuredClone(reviews)]);
  }
  async createJob(j: JobDoc) {
    this.jobs.set(j.id, structuredClone(j));
  }
  async getJob(id: string) {
    const j = this.jobs.get(id);
    return j ? structuredClone(j) : null;
  }
  async listJobs(limit: number) {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  async updateJob(id: string, patch: Partial<JobDoc>) {
    const prev = this.jobs.get(id);
    if (prev) this.jobs.set(id, { ...prev, ...structuredClone(patch), updatedAt: Date.now() });
  }
  async lockJob(id: string, ms: number, now: number) {
    const j = this.jobs.get(id);
    if (!j || j.lockedUntil > now) return null;
    j.lockedUntil = now + ms;
    return structuredClone(j);
  }
}

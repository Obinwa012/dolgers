import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import type { AeTokens, TokenStore } from '../aliexpress/client.ts';
import { mergeConfig, type VettingConfig } from '../vetting/config.ts';
import type { CandidateDoc, CandidateStatus, ProductDoc, RunDoc, SellerDoc, SourcingDoc, VettingDoc } from './model.ts';

/** Everything the pipeline reads and writes. Firestore in production; memory for tests and dry runs. */
export interface Repo {
  loadConfig(): Promise<VettingConfig>;
  tokenStore(): TokenStore;
  upsertCandidates(items: CandidateDoc[]): Promise<{ added: number; updated: number }>;
  /** Candidates that are new, or whose recheck date has passed, most recent sales first. */
  dueCandidates(limit: number, now: number): Promise<CandidateDoc[]>;
  updateCandidate(subId: string, patch: Partial<CandidateDoc>): Promise<void>;
  getProduct(id: string): Promise<ProductDoc | null>;
  listProducts(statuses: ProductDoc['status'][]): Promise<ProductDoc[]>;
  saveProduct(p: ProductDoc, sourcing: SourcingDoc, vetting: VettingDoc): Promise<void>;
  updateProduct(id: string, patch: Partial<ProductDoc>): Promise<void>;
  getSourcing(id: string): Promise<SourcingDoc | null>;
  productIdsByStore(storeId: string): Promise<string[]>;
  updateSourcing(id: string, patch: Partial<SourcingDoc>): Promise<void>;
  saveVetting(v: VettingDoc): Promise<void>;
  getSeller(storeId: string): Promise<SellerDoc | null>;
  blockedSellers(): Promise<SellerDoc[]>;
  saveSeller(s: SellerDoc): Promise<void>;
  startRun(r: RunDoc): Promise<void>;
  finishRun(id: string, patch: Partial<RunDoc>): Promise<void>;
}

export function initAdmin(projectId = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT ?? 'demo-dolgers'): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp(sa ? { credential: cert(JSON.parse(sa)), projectId } : { projectId });
}

const DUE_STATUSES: CandidateStatus[] = ['new', 'screened_out', 'insufficient_data', 'error'];
/** A candidate that errors this many times stops being retried. */
export const MAX_ATTEMPTS = 5;

export function adminDb(): Firestore {
  const db = getFirestore(initAdmin());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* already configured */
  }
  return db;
}

export class FirestoreRepo implements Repo {
  constructor(private readonly db: Firestore = adminDb()) {}

  async loadConfig() {
    const snap = await this.db.doc('config/pipeline').get();
    return mergeConfig(snap.data() as Partial<VettingConfig> | undefined);
  }

  tokenStore(): TokenStore {
    const ref = this.db.doc('config/aliexpress');
    return {
      load: async () => {
        const d = (await ref.get()).data();
        return d?.accessToken ? (d as AeTokens) : null;
      },
      save: async (t) => {
        await ref.set({ ...t, updatedAt: Date.now() }, { merge: true });
      },
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
          batch.set(refs[j]!, c);
          added++;
        } else {
          const prev = snap.data() as CandidateDoc;
          batch.update(refs[j]!, {
            feeds: [...new Set([...prev.feeds, ...c.feeds])],
            recentSales: c.recentSales,
            feedPriceCents: c.feedPriceCents,
            updatedAt: c.updatedAt,
          });
          updated++;
        }
      });
      await batch.commit();
    }
    return { added, updated };
  }

  async dueCandidates(limit: number, now: number) {
    const fresh = await this.db
      .collection('candidates')
      .where('status', '==', 'new')
      .orderBy('recentSales', 'desc')
      .limit(limit)
      .get();
    const out = fresh.docs.map((d) => d.data() as CandidateDoc);
    if (out.length < limit) {
      const again = await this.db
        .collection('candidates')
        .where('status', 'in', DUE_STATUSES.filter((s) => s !== 'new'))
        .where('nextCheckAt', '<=', now)
        .orderBy('nextCheckAt')
        .limit((limit - out.length) * 2)
        .get();
      out.push(
        ...again.docs
          .map((d) => d.data() as CandidateDoc)
          .filter((c) => c.status !== 'error' || c.attempts < MAX_ATTEMPTS)
          .slice(0, limit - out.length),
      );
    }
    return out;
  }

  async updateCandidate(subId: string, patch: Partial<CandidateDoc>) {
    await this.db.collection('candidates').doc(subId).set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }

  async getProduct(id: string) {
    return ((await this.db.collection('products').doc(id).get()).data() as ProductDoc | undefined) ?? null;
  }

  async listProducts(statuses: ProductDoc['status'][]) {
    const snap = await this.db.collection('products').where('status', 'in', statuses).get();
    return snap.docs.map((d) => d.data() as ProductDoc);
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
    const snap = await this.db.collection('sourcing').where('storeId', '==', storeId).get();
    return snap.docs.map((d) => d.id);
  }

  async updateSourcing(id: string, patch: Partial<SourcingDoc>) {
    await this.db.collection('sourcing').doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
  }

  async saveVetting(v: VettingDoc) {
    await this.db.collection('vetting').doc(v.productId).set(v);
  }

  async getSeller(storeId: string) {
    return ((await this.db.collection('sellers').doc(storeId).get()).data() as SellerDoc | undefined) ?? null;
  }

  async blockedSellers() {
    const snap = await this.db.collection('sellers').where('blocked', '==', true).get();
    return snap.docs.map((d) => d.data() as SellerDoc);
  }

  async saveSeller(s: SellerDoc) {
    await this.db.collection('sellers').doc(s.storeId).set(s);
  }

  async startRun(r: RunDoc) {
    await this.db.collection('runs').doc(r.id).set(r);
  }

  async finishRun(id: string, patch: Partial<RunDoc>) {
    await this.db.collection('runs').doc(id).set(patch, { merge: true });
  }
}

/** In-memory repo for tests and `--dry-run`; `dump()` returns everything for inspection. */
export class MemoryRepo implements Repo {
  config: Partial<VettingConfig> = {};
  tokens: AeTokens | null = null;
  candidates = new Map<string, CandidateDoc>();
  products = new Map<string, ProductDoc>();
  sourcing = new Map<string, SourcingDoc>();
  vetting = new Map<string, VettingDoc>();
  sellers = new Map<string, SellerDoc>();
  runs = new Map<string, RunDoc>();

  async loadConfig() {
    return mergeConfig(this.config);
  }
  tokenStore(): TokenStore {
    return { load: async () => this.tokens, save: async (t) => void (this.tokens = t) };
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
    const fresh = all.filter((c) => c.status === 'new').sort((a, b) => b.recentSales - a.recentSales);
    const again = all
      .filter((c) => DUE_STATUSES.includes(c.status) && c.status !== 'new' && c.nextCheckAt !== null && c.nextCheckAt <= now)
      .filter((c) => c.status !== 'error' || c.attempts < MAX_ATTEMPTS)
      .sort((a, b) => a.nextCheckAt! - b.nextCheckAt!);
    return [...fresh, ...again].slice(0, limit);
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
    this.products.set(p.id, p);
    this.sourcing.set(p.id, s);
    this.vetting.set(p.id, v);
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
  async saveVetting(v: VettingDoc) {
    this.vetting.set(v.productId, v);
  }
  async getSeller(storeId: string) {
    return this.sellers.get(storeId) ?? null;
  }
  async blockedSellers() {
    return [...this.sellers.values()].filter((s) => s.blocked);
  }
  async saveSeller(s: SellerDoc) {
    this.sellers.set(s.storeId, s);
  }
  async startRun(r: RunDoc) {
    this.runs.set(r.id, r);
  }
  async finishRun(id: string, patch: Partial<RunDoc>) {
    const prev = this.runs.get(id);
    if (prev) this.runs.set(id, { ...prev, ...patch });
  }
  dump() {
    const o = <T>(m: Map<string, T>) => Object.fromEntries(m);
    return {
      candidates: o(this.candidates), products: o(this.products), sourcing: o(this.sourcing),
      vetting: o(this.vetting), sellers: o(this.sellers), runs: o(this.runs),
    };
  }
}

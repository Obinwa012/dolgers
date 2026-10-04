'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MAX_LINE_QUANTITY, type Cents, type ProductImage } from '@dolgers/shared';

/**
 * One line in the bag. The display fields are a snapshot for instant rendering only; prices are
 * always re-read from the database (bag page quote, then checkout) before anything is charged.
 */
export interface BagLine {
  sku: string;
  productId: string;
  slug: string;
  title: string;
  vendorId: string;
  vendorName: string;
  size: string;
  colour: string;
  price: Cents;
  image: ProductImage | null;
  quantity: number;
}

interface BagState {
  lines: BagLine[];
  count: number;
  hydrated: boolean;
  add(line: Omit<BagLine, 'quantity'>, quantity?: number): void;
  setQuantity(sku: string, quantity: number): void;
  remove(sku: string): void;
  clear(): void;
}

const KEY = 'dolgers.bag.v1';
const BagContext = createContext<BagState | null>(null);

function load(): BagLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((l) => typeof l?.sku === 'string' && Number.isInteger(l?.quantity)).slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setLines(load());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setLines(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // storage full or blocked: the bag still works for this visit
    }
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<BagLine, 'quantity'>, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === line.sku);
      if (existing) return prev.map((l) => (l.sku === line.sku ? { ...l, ...line, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + quantity) } : l));
      return [...prev, { ...line, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }];
    });
  }, []);

  const setQuantity = useCallback((sku: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l)),
    );
  }, []);

  const remove = useCallback((sku: string) => setLines((prev) => prev.filter((l) => l.sku !== sku)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<BagState>(
    () => ({ lines, count: lines.reduce((s, l) => s + l.quantity, 0), hydrated, add, setQuantity, remove, clear }),
    [lines, hydrated, add, setQuantity, remove, clear],
  );
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagState {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used inside BagProvider');
  return ctx;
}

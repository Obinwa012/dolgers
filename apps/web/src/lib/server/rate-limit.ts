import 'server-only';

// Best-effort, per-instance limiter for read-only endpoints. Anything that writes is limited in
// Cloud Functions with a shared Firestore counter instead.
const buckets = new Map<string, { start: number; count: number }>();

export function allow(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || t - b.start > windowMs) {
    buckets.set(key, { start: t, count: 1 });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (t - v.start > windowMs) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

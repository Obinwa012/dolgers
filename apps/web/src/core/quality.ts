/**
 * Your own orders as quality data. Every order, refund, complaint and payment dispute you record
 * on a product goes through these rules, and the order system will feed the same function later.
 */
import type { ProductDoc, QualityEvent, QualityRecord } from './firestore/model.ts';
import { addFlags, CLEARED_CHECKS } from './stages.ts';
import type { VettingConfig } from './vetting/config.ts';
import { ISSUE_RULES, type IssueCategory } from './vetting/issues.ts';

export const EMPTY_QUALITY: QualityRecord = { orders: 0, refunds: 0, complaintsB: 0, complaintsC: 0, disputes: 0, events: [] };

export function applyQualityEvent(p: ProductDoc, ev: QualityEvent, config: VettingConfig): { patch: Partial<ProductDoc>; notes: string[] } {
  const q: QualityRecord = { ...EMPTY_QUALITY, ...(p.quality ?? {}), events: [...(p.quality?.events ?? []), ev].slice(-200) };
  const probation = { ...p.probation };
  const notes: string[] = [];
  const pauseReasons: string[] = [];
  const flags: string[] = [];
  let urgent = false;
  const n = Math.max(1, Math.round(ev.count));

  if (ev.kind === 'orders') {
    q.orders += n;
    probation.orders += n;
  } else if (ev.kind === 'refund') {
    q.refunds += n;
  } else if (ev.kind === 'complaint') {
    const rule = ev.category && ev.category in ISSUE_RULES ? ISSUE_RULES[ev.category as IssueCategory] : null;
    const bucket = ev.bucket ?? rule?.bucket ?? 'B';
    const label = rule?.label ?? ev.category ?? 'Complaint';
    if (bucket === 'C') {
      q.complaintsC += 1;
      probation.defects += 1;
      pauseReasons.push(`Your customer reported a problem that can't be fixed: ${label}${ev.note ? ` ("${ev.note.slice(0, 120)}")` : ''}`);
    } else if (bucket === 'B') {
      q.complaintsB += 1;
      probation.defects += 1;
      notes.push(`Complaint recorded: ${label}`);
    } else {
      notes.push(`Complaint recorded: ${label} (fixable on the listing)`);
      flags.push(`Customer complaint the listing should prevent: ${label}`);
    }
  } else if (ev.kind === 'dispute') {
    q.disputes += n;
    urgent = true;
    flags.push(`Payment dispute${ev.note ? ` ("${ev.note.slice(0, 120)}")` : ''}: review this product today`);
  }

  if (q.orders >= config.refundRateMinOrders && q.refunds / q.orders > config.maxRefundRate) {
    pauseReasons.push(`Refund rate is ${Math.round((q.refunds / q.orders) * 100)}% (${q.refunds} of ${q.orders} orders), over ${Math.round(config.maxRefundRate * 100)}%: review before selling again`);
  }
  if (probation.active) {
    if (probation.defects >= probation.maxDefects && probation.orders <= probation.windowOrders) {
      pauseReasons.push(`Probation: ${probation.defects} defects in the first ${probation.orders} orders (limit ${probation.maxDefects - 1})`);
    } else if (probation.orders >= probation.windowOrders) {
      probation.active = false;
      notes.push(`Passed probation: ${probation.defects} defects in ${probation.orders} orders`);
    }
  }

  const patch: Partial<ProductDoc> = { quality: q, probation, updatedAt: ev.at };
  const allFlags = [...flags, ...pauseReasons].map((text) => ({ at: ev.at, source: 'customer' as const, text, urgent: urgent || undefined }));
  if (allFlags.length) patch.flags = addFlags(p.flags, allFlags);
  if (pauseReasons.length && (p.status === 'live' || p.status === 'pending_review')) {
    patch.status = 'paused';
    patch.holdReasons = pauseReasons;
    patch.review = CLEARED_CHECKS; // publishing again means checking again
    notes.push('Paused');
  }
  return { patch, notes: [...notes, ...pauseReasons, ...flags] };
}

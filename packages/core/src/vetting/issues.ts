/**
 * The issue taxonomy. The AI only *finds* issues and quotes them; the bucket each issue falls in
 * is decided here, in code, so a model can't talk a defect into being "fixable".
 *
 * A = prevent it on the listing (size chart, disclosure, honest delivery promise). Doesn't count
 *     toward the problem rate once the fix is applied.
 * B = absorb it with customer service (refund/reship). Counts toward the 1-in-40 cap.
 * C = can't be fixed. `rejectAt` independent buyers reject the product; fewer flag it for review.
 *     `sellerLevel` issues also count against the seller's other listings.
 */
export type Bucket = 'A' | 'B' | 'C';

export interface IssueRule {
  bucket: Bucket;
  /** For B issues that become systemic when repeated (e.g. one lost parcel vs. a pattern). */
  escalateToCAt?: number;
  /** For C issues: buyers needed to reject outright (default: config.systemicRejectBuyers). */
  rejectAt?: number;
  sellerLevel?: boolean;
  /** The listing fix that neutralizes an A issue. */
  fix?: string;
  label: string;
}

export const ISSUE_RULES = {
  fit_large: { bucket: 'A', label: 'Runs large', fix: 'Fit note and size chart: size down if between sizes' },
  fit_small: { bucket: 'A', label: 'Runs small', fix: 'Fit note and size chart: size up if between sizes' },
  length_short: { bucket: 'A', label: 'Short in length/inseam', fix: 'Publish length/inseam; note for tall buyers' },
  length_long: { bucket: 'A', label: 'Long in length/sleeves', fix: 'Publish length and sleeve measurements' },
  fabric_thin: { bucket: 'A', label: 'Thinner/lighter than expected', fix: 'Describe as lightweight' },
  fabric_feel: { bucket: 'A', label: 'Fabric feel differs from expectation', fix: 'Describe the fabric accurately' },
  color_differs: { bucket: 'A', label: 'Colour differs from photo', fix: 'Colour note on the listing' },
  decorative_feature: { bucket: 'A', label: 'Feature is decorative/non-functional', fix: 'Disclose it plainly; remove the claim from the title' },
  pack_contents: { bucket: 'A', label: 'Pack contents unclear (colours/quantity)', fix: 'State exactly what is in the pack' },
  slow_delivery: { bucket: 'A', label: 'Slower than expected delivery', fix: 'Promise the quoted delivery window, not a faster one' },
  wrinkled_on_arrival: { bucket: 'A', label: 'Arrives wrinkled', fix: 'Care note: wash or steam before wearing' },

  hole_or_tear: { bucket: 'B', label: 'Hole, tear or rip', escalateToCAt: 4 },
  stitching_defect: { bucket: 'B', label: 'Stitching or seam defect' },
  misprint: { bucket: 'B', label: 'Crooked, reversed or wrong print', escalateToCAt: 4 },
  wrong_item: { bucket: 'B', label: 'Wrong item, colour or size sent', escalateToCAt: 4 },
  missing_item: { bucket: 'B', label: 'Item missing from the parcel' },
  dirty_or_used: { bucket: 'B', label: 'Dirty, stained or used' },
  damaged_in_transit: { bucket: 'B', label: 'Damaged in transit' },
  non_delivery: { bucket: 'B', label: 'Never delivered', escalateToCAt: 2, sellerLevel: true },
  refund_refused: { bucket: 'B', label: 'Seller refused a refund/return', escalateToCAt: 2, sellerLevel: true },
  unexplained_low_rating: { bucket: 'B', label: '1–3 star rating with no stated reason' },

  wash_durability: { bucket: 'C', label: 'Print peels/fades or garment shrinks after washing' },
  material_mismatch: { bucket: 'C', label: 'Material differs from the listing' },
  quality_drop_repeat: { bucket: 'C', label: 'Quality dropped on repeat orders', sellerLevel: true },
  fit_inconsistent: { bucket: 'C', label: 'Sizing inconsistent between units (both runs big and small)' },
  fake_tracking: { bucket: 'C', label: 'Fake/fraudulent tracking or postage', rejectAt: 1, sellerLevel: true },
  counterfeit_or_ip: { bucket: 'C', label: 'Counterfeit, brand or likeness', rejectAt: 1 },
  unsafe: { bucket: 'C', label: 'Safety hazard (skin reaction, chemical smell, sharp parts)', rejectAt: 1 },
} as const satisfies Record<string, IssueRule>;

export type IssueCategory = keyof typeof ISSUE_RULES;
export const ISSUE_CATEGORIES = Object.keys(ISSUE_RULES) as IssueCategory[];

export function ruleFor(category: IssueCategory): IssueRule {
  return ISSUE_RULES[category];
}

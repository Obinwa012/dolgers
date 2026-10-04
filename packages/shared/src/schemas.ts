// Input validation for every Cloud Function action. The website uses the same schemas for its
// forms, but only the server-side check counts.
import { z } from 'zod';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from './constants.ts';
import { DELIVERY_METHODS, DEPARTMENTS, PRODUCT_STATUSES, SIZE_SYSTEMS } from './types.ts';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const cents = z.number().int().min(0).max(10_000_000);
const httpsUrl = z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(500)]);

export const addressSchema = z.object({
  firstName: required(60),
  lastName: required(60),
  line1: required(120),
  line2: text(120).default(''),
  city: required(80),
  state: z.string().regex(/^[A-Z]{2}$/),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.literal('US'),
  phone: z.string().trim().regex(/^[+()\d\s.-]{0,25}$/).default(''),
});

export const cartLineSchema = z.object({
  sku: id,
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const cartQuoteSchema = z.object({
  lines: z.array(cartLineSchema).max(MAX_CART_LINES),
  delivery: z.enum(DELIVERY_METHODS).default('standard'),
  promoCode: text(40).nullable().default(null),
});

export const createCheckoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(MAX_CART_LINES),
  email: z.email().max(200),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.nullable().default(null),
  delivery: z.enum(DELIVERY_METHODS),
  promoCode: text(40).nullable().default(null),
  marketingOptIn: z.boolean().default(false),
  /** A pending order from an earlier attempt; its stock hold is released first. */
  replaceOrderId: id.nullable().default(null),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const imageSchema = z.object({
  url: z.string().max(1000).refine((u) => u.startsWith('https://') || u.startsWith('/'), 'Image must be https'),
  alt: text(200).default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  tone: text(200).optional(),
});

export const variantInputSchema = z.object({
  sku: id.optional(),
  size: required(20),
  price: cents.min(100),
  compareAtPrice: cents.nullable().default(null),
  stock: z.number().int().min(0).max(100_000).optional(),
});

export const productInputSchema = z.object({
  id: id.optional(),
  title: required(120),
  description: text(4000).default(''),
  composition: text(500).default(''),
  care: text(500).default(''),
  fitNote: text(300).default(''),
  department: z.enum(DEPARTMENTS),
  categoryId: id,
  sizeSystem: z.enum(SIZE_SYSTEMS),
  colour: z.object({ name: required(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  images: z.array(imageSchema).max(12).default([]),
  variants: z.array(variantInputSchema).min(1).max(30),
  related: z.array(id).max(8).default([]),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const vendorProfileSchema = z.object({
  tagline: text(200),
  storyTitle: text(120).default(''),
  story: text(4000),
  banner: imageSchema.nullable().default(null),
  storyImage: imageSchema.nullable().default(null),
  facts: z.object({
    founded: text(20).default(''),
    basedIn: text(80).default(''),
    madeIn: text(80).default(''),
    shipsFrom: text(80).default(''),
    dispatchDays: z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(60)]).default([2, 5]),
  }),
});

export const vendorApplicationSchema = z.object({
  businessName: required(80),
  contactName: required(80),
  website: httpsUrl.default(''),
  instagram: text(60).default(''),
  description: z.string().trim().min(40).max(2000),
  departments: z.array(z.enum(DEPARTMENTS)).min(1),
  shipsFrom: required(80),
});

const trackingSchema = z.object({
  vendorOrderId: z.string().regex(/^[A-Za-z0-9_-]{1,260}$/),
  carrier: required(40),
  number: required(60),
  url: httpsUrl.default(''),
});

/** Actions vendors can call. Each is checked against the caller's vendor membership. */
export const vendorActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('apply'), data: vendorApplicationSchema }),
  z.object({ action: z.literal('onboardingLink'), data: z.object({}).default({}) }),
  z.object({ action: z.literal('dashboardLink'), data: z.object({}).default({}) }),
  z.object({ action: z.literal('updateProfile'), data: vendorProfileSchema }),
  z.object({ action: z.literal('upsertProduct'), data: productInputSchema }),
  z.object({ action: z.literal('submitProduct'), data: z.object({ productId: id }) }),
  z.object({ action: z.literal('archiveProduct'), data: z.object({ productId: id }) }),
  z.object({
    action: z.literal('setStock'),
    data: z.object({ items: z.array(z.object({ sku: id, onHand: z.number().int().min(0).max(100_000) })).min(1).max(100) }),
  }),
  z.object({ action: z.literal('markShipped'), data: trackingSchema }),
  z.object({
    action: z.literal('reviewReturn'),
    data: z.object({ returnId: id, approve: z.boolean(), note: text(500).default('') }),
  }),
  z.object({ action: z.literal('refundReturn'), data: z.object({ returnId: id }) }),
]);
export type VendorAction = z.infer<typeof vendorActionSchema>;

export const promoInputSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1).max(10_000_000),
  minSubtotal: cents.default(0),
  active: z.boolean().default(true),
  startsAt: z.number().int().nullable().default(null),
  endsAt: z.number().int().nullable().default(null),
  maxRedemptions: z.number().int().positive().nullable().default(null),
}).refine((p) => p.type !== 'percent' || p.value <= 90, { message: 'Percent discounts are capped at 90%.' });

const ctaSchema = z.object({ label: text(40), href: z.string().trim().regex(/^\/[A-Za-z0-9/_?=&.-]*$/).max(200) });

export const homeContentSchema = z.object({
  announcement: text(140),
  hero: z.object({
    eyebrow: text(60), title: required(80), body: text(300),
    primary: ctaSchema, secondary: ctaSchema, image: imageSchema.nullable(),
  }),
  departments: z.array(z.object({ title: required(40), body: text(200), cta: ctaSchema, image: imageSchema.nullable() })).max(4),
  edit: z.object({
    eyebrow: text(60), title: required(80), body: text(400), cta: ctaSchema, image: imageSchema.nullable(),
    productIds: z.array(id).max(4),
  }),
  newArrivalIds: z.array(id).max(12),
});

export const categoryInputSchema = z.object({
  id: id.optional(),
  name: required(60),
  parentId: id.nullable(),
  description: text(300).default(''),
  order: z.number().int().min(0).max(1000).default(0),
});

/** Actions admins can call. */
export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reviewApplication'),
    data: z.object({ uid: id, approve: z.boolean(), note: text(500).default(''), commissionBps: z.number().int().min(0).max(5000).optional() }),
  }),
  z.object({
    action: z.literal('setProductStatus'),
    data: z.object({ productId: id, status: z.enum(PRODUCT_STATUSES), note: text(500).default(''), featured: z.boolean().optional() }),
  }),
  z.object({
    action: z.literal('updateVendor'),
    data: z.object({
      vendorId: id,
      status: z.enum(['active', 'suspended']).optional(),
      commissionBps: z.number().int().min(0).max(5000).optional(),
      autoApprove: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal('refund'),
    data: z.object({ vendorOrderId: z.string().regex(/^[A-Za-z0-9_-]{1,260}$/), amount: cents.min(1), reason: required(300) }),
  }),
  z.object({ action: z.literal('upsertPromo'), data: promoInputSchema }),
  z.object({ action: z.literal('updateHome'), data: homeContentSchema }),
  z.object({ action: z.literal('upsertCategory'), data: categoryInputSchema }),
  z.object({ action: z.literal('setAdmin'), data: z.object({ email: z.email(), admin: z.boolean() }) }),
  z.object({ action: z.literal('reindexSearch'), data: z.object({}).default({}) }),
  z.object({ action: z.literal('retryPayout'), data: z.object({ vendorOrderId: z.string().regex(/^[A-Za-z0-9_-]{1,260}$/) }) }),
]);
export type AdminAction = z.infer<typeof adminActionSchema>;

/** Actions any signed-in shopper can call. */
export const accountActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('requestReturn'),
    data: z.object({
      vendorOrderId: z.string().regex(/^[A-Za-z0-9_-]{1,260}$/),
      lines: z.array(z.object({ sku: id, quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY) })).min(1),
      reason: required(500),
    }),
  }),
  z.object({ action: z.literal('subscribe'), data: z.object({ email: z.email().max(200) }) }),
  z.object({ action: z.literal('cancelPendingOrder'), data: z.object({ orderId: id }) }),
]);
export type AccountAction = z.infer<typeof accountActionSchema>;

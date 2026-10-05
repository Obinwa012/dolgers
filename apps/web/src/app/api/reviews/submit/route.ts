import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/server/firebase-admin';

/**
 * Submit a product review from a verified Dolgers purchase.
 * 
 * Body: {
 *   productSlug: string,
 *   orderId: string,
 *   email: string,
 *   stars: number (1-5),
 *   text: string,
 * }
 * 
 * Verifies the order exists and the email matches before accepting.
 * Reviews are stored in the `dolgers_reviews` collection, separate from
 * imported supplier reviews. They show as "Verified Dolgers purchase".
 */
export async function POST(req: Request) {
  const db = serverDb();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { productSlug, orderId, email, stars, text } = body;

  // Validate
  if (!productSlug || !orderId || !email || !stars || !text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (typeof stars !== 'number' || stars < 1 || stars > 5 || !Number.isInteger(stars)) {
    return NextResponse.json({ error: 'Stars must be an integer 1-5' }, { status: 400 });
  }
  if (typeof text !== 'string' || text.trim().length < 10) {
    return NextResponse.json({ error: 'Review text must be at least 10 characters' }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Review text too long (max 2000)' }, { status: 400 });
  }

  // Verify the order exists and email matches
  // Order ID format: we store orders by Stripe PI or our tracking code
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  const order = orderSnap.data();
  const orderEmail = order?.email?.toLowerCase().trim();
  if (orderEmail !== email.toLowerCase().trim()) {
    return NextResponse.json({ error: 'Email does not match order' }, { status: 403 });
  }

  // Verify the product is in the order
  const items = order?.items || [];
  const hasProduct = items.some((item: any) => 
    item.productSlug === productSlug || item.slug === productSlug
  );
  if (!hasProduct) {
    return NextResponse.json({ error: 'Product not in this order' }, { status: 403 });
  }

  // Check for duplicate review (one per order+product)
  const existingQuery = await db.collection('dolgers_reviews')
    .where('orderId', '==', orderId)
    .where('productSlug', '==', productSlug)
    .limit(1)
    .get();
  if (!existingQuery.empty) {
    return NextResponse.json({ error: 'Review already submitted for this order' }, { status: 409 });
  }

  // Store the review
  const review = {
    productSlug,
    orderId,
    // Don't store raw email; store a hash for deduping, display first name only
    emailHash: hashEmail(email),
    displayName: extractFirstName(order),
    stars,
    text: text.trim(),
    verified: true,
    source: 'dolgers',
    createdAt: Date.now(),
  };

  const docRef = await db.collection('dolgers_reviews').add(review);

  return NextResponse.json({ 
    success: true, 
    reviewId: docRef.id,
    message: 'Thank you for your review!'
  });
}

function hashEmail(email: string): string {
  // Simple hash for deduping (not cryptographic, just for matching)
  let hash = 0;
  const s = email.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

function extractFirstName(order: any): string {
  const name = order?.shippingName || order?.customerName || '';
  return name.split(' ')[0] || 'Verified buyer';
}

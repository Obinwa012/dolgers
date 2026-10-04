import { createHmac } from 'node:crypto';
import { logger } from 'firebase-functions';
import { REVALIDATE_SECRET, SITE_URL } from './params.ts';

/**
 * Asks the website to refresh cached pages carrying these tags. Signed with a shared secret so
 * only Functions can trigger it. Failures are logged, never thrown: a stale page is better than a
 * failed write.
 */
export async function revalidate(tags: string[]) {
  const secret = REVALIDATE_SECRET.value();
  const site = SITE_URL.value();
  if (!secret || !site || !tags.length) return;
  const body = JSON.stringify({ tags: [...new Set(tags)], at: Date.now() });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dolgers-signature': signature },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn('revalidate failed', { status: res.status, tags });
  } catch (err) {
    logger.warn('revalidate error', { err: String(err), tags });
  }
}

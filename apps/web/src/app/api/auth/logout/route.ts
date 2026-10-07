import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, destroyAdminSession } from '@/lib/admin-auth';

export async function POST() {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (token) await destroyAdminSession(token);
  } catch { /* ignore */ }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}

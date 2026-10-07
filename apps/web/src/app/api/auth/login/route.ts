import { NextResponse } from 'next/server';
import { COOKIE_NAME, SESSION_TTL_MS, createAdminSession, verifyAdminPassword } from '@/lib/admin-auth';

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!verifyAdminPassword(body.password ?? '')) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  try {
    const token = await createAdminSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not create a session.' },
      { status: 500 },
    );
  }
}

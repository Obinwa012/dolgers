import { type NextRequest, NextResponse } from 'next/server';

/**
 * A first, cheap filter: requests without a session cookie never reach an admin page. The real
 * check (a valid session for a current admin) runs on the server in every page and action.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has('dolgers_admin_session')) return NextResponse.next();
  if (req.method === 'GET' || req.method === 'HEAD') return NextResponse.redirect(new URL('/login', req.url));
  return new NextResponse('Sign in first.', { status: 401 });
}

export const config = {
  // Everything except the sign-in page, the AliExpress return (it checks the session itself),
  // Next.js assets and the icon.
  matcher: ['/((?!login|api/auth/ae/callback|_next/static|_next/image|icon.svg|favicon.ico).*)'],
};

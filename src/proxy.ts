import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAllowedEmail } from '@/lib/auth/allowlist';

// Renamed from `middleware` to `proxy` per Next.js 16 (functionality is unchanged).
// /api/gmail/sync is here too - it authenticates itself (real user session for a fresh call,
// a shared secret for the server's own self-chained continuation calls, see that route), so
// this pre-filter would otherwise redirect the secret-authenticated continuation calls (which
// carry no user cookie at all) to /login and 405 there.
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/unauthorized', '/api/gmail/sync'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() (not getSession()) so this is verified against the Auth server, not just a
  // decoded cookie - this file is an optimistic pre-filter, but it still needs to be correct
  // about identity since it's what actually kicks out a non-owner Google account.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return path === '/unauthorized' ? response : NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

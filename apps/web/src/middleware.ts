import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// The gate — runs before every request except static assets, the marketing
// landing page and legal pages, the public RSVP form, and their supporting
// public API routes. Everything else requires a signed-in session.
const PUBLIC_PATHS = ['/', '/sign-in', '/auth', '/r', '/api/public', '/terms', '/privacy'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  // PREVIEW_MODE: no real Supabase project configured yet — skip the auth
  // gate entirely so the whole app can be clicked through against the
  // in-memory sample data (lib/preview/*). Never set in a real deployment.
  if (process.env.PREVIEW_MODE === 'true') {
    // Let /sign-in itself render (it's the real, designed front door — Part
    // 2.5) instead of forcing past it. Only skip the *gate* that would
    // otherwise bounce every other page back to it, since there's no real
    // session to check.
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Signed-in users get bounced off /sign-in (nothing to do there), but '/'
  // stays reachable even while signed in — it's the marketing page, and a
  // signed-in Host should still be able to click back to it from the app.
  if (user && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and image optimization,
     * which never carry tenant data.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

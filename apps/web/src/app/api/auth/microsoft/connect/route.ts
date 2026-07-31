import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getMicrosoftAuthUrl, MicrosoftNotConfiguredError } from '@/lib/msgraph';

// Part 11.1: "a single 'Connect your Microsoft account' button in Settings
// triggers the standard Microsoft sign-in." This route just kicks off that
// standard OAuth authorization-code flow.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const state = randomBytes(16).toString('hex');

  try {
    const authUrl = await getMicrosoftAuthUrl(state);
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('ms_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return response;
  } catch (err) {
    if (err instanceof MicrosoftNotConfiguredError) {
      return NextResponse.redirect(new URL('/settings?ms_error=not_configured', request.url));
    }
    return NextResponse.redirect(new URL('/settings?ms_error=unknown', request.url));
  }
}

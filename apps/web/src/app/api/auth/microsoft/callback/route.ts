import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';
import { exchangeMicrosoftCode } from '@/lib/msgraph';
import { encryptSecret } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get('ms_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/settings?ms_error=invalid_state', request.url));
  }

  try {
    const { appUser } = await requireCurrentUser();
    const supabase = await createClient();

    const result = await exchangeMicrosoftCode(code);
    const encryptedRefreshToken = encryptSecret(result.refreshToken);

    await supabase.from('mailbox_connections').upsert(
      {
        tenant_id: appUser.tenant_id,
        provider: 'microsoft',
        connected_email: result.email,
        encrypted_refresh_token: encryptedRefreshToken,
        access_token_expires_at: result.accessTokenExpiresAt?.toISOString() ?? null,
        status: 'connected',
        last_error: null,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    const response = NextResponse.redirect(new URL('/settings?ms_connected=1', request.url));
    response.cookies.delete('ms_oauth_state');
    return response;
  } catch (err) {
    const response = NextResponse.redirect(new URL('/settings?ms_error=exchange_failed', request.url));
    response.cookies.delete('ms_oauth_state');
    return response;
  }
}

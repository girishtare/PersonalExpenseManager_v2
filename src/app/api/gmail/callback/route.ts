import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { createOAuthClient } from '@/lib/google/oauth';
import { encrypt } from '@/lib/crypto/secret-box';

const STATE_COOKIE = 'gmail_oauth_state';

function fail(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/settings?gmail_error=${encodeURIComponent(reason)}`);
}

export async function GET(request: Request) {
  const user = await requireOwnerUser();
  const { searchParams, origin } = new URL(request.url);
  const oauthError = searchParams.get('error');
  if (oauthError) return fail(origin, oauthError);

  const code = searchParams.get('code');
  const state = searchParams.get('state') ?? '';
  const [nonce, role] = state.split(':');

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !nonce || nonce !== expectedNonce || (role !== 'historical' && role !== 'live')) {
    return fail(origin, 'invalid_state');
  }

  const redirectUri = `${origin}/api/gmail/callback`;
  const client = createOAuthClient(redirectUri);

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // Google only issues a refresh token on the FIRST consent (or when prompt=consent forces a
    // fresh one, which /connect always sets) - surface this rather than storing an unusable
    // connection that can mint an access token today but not tomorrow.
    return fail(origin, 'no_refresh_token');
  }

  const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) return fail(origin, 'profile_fetch_failed');
  const profile: { emailAddress?: string } = await profileResponse.json();
  const emailAddress = profile.emailAddress;
  if (!emailAddress) return fail(origin, 'no_profile');

  const supabase = await createClient();
  const { error: dbError } = await supabase.from('email_connections').upsert(
    {
      user_id: user.id,
      email_address: emailAddress,
      role,
      refresh_token: encrypt(tokens.refresh_token),
    },
    { onConflict: 'user_id,email_address' }
  );
  if (dbError) return fail(origin, dbError.message);

  return NextResponse.redirect(`${origin}/settings?gmail_connected=${encodeURIComponent(emailAddress)}`);
}

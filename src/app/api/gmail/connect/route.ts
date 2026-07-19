import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOwnerUser } from '@/lib/auth/dal';
import { buildAuthUrl } from '@/lib/google/oauth';

const STATE_COOKIE = 'gmail_oauth_state';

export async function GET(request: Request) {
  await requireOwnerUser();
  const { searchParams, origin } = new URL(request.url);
  const role = searchParams.get('role');
  if (role !== 'historical' && role !== 'live' && role !== 'pre_historical') {
    return NextResponse.json({ error: 'role must be "historical", "pre_historical", or "live"' }, { status: 400 });
  }

  const nonce = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });

  const redirectUri = `${origin}/api/gmail/callback`;
  const url = buildAuthUrl({ redirectUri, state: `${nonce}:${role}` });
  return NextResponse.redirect(url);
}

import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail } from './allowlist';

/**
 * The authoritative auth check - calls Supabase's Auth server (not just decoding a cookie),
 * so use this in Server Components/Route Handlers/Server Actions close to the data being
 * fetched. proxy.ts only does an optimistic pre-filter; this is the real gate.
 */
export async function requireOwnerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    redirect('/unauthorized');
  }
  return user;
}

import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client that bypasses RLS entirely. Only call this from code paths already
 * gated by requireOwnerUser() - it must never be reachable by an unauthenticated or
 * non-owner request, since it has no row-level restrictions of its own.
 */
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

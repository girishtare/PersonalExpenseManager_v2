/**
 * This app is for a single owner. Supabase's Google provider alone will let any Google
 * account complete sign-in, so every layer (proxy, callback, DAL) checks the authenticated
 * email against this allowlist before granting access.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const owner = process.env.ALLOWED_OWNER_EMAIL;
  if (!owner || !email) return false;
  return email.toLowerCase() === owner.toLowerCase();
}

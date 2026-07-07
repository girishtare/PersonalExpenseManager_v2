'use client';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Personal Expense Manager</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Access is restricted to the owner&apos;s Google account.</p>
      <Button type="button" size="lg" onClick={handleSignIn}>
        Sign in with Google
      </Button>
    </main>
  );
}

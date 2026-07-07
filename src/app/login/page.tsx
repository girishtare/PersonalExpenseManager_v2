'use client';

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
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Access is restricted to the owner&apos;s Google account.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Sign in with Google
      </button>
    </main>
  );
}

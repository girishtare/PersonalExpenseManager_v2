import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Not authorized</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This app is restricted to its owner&apos;s Google account. If you signed in with the
        wrong account, sign out of it in your browser and try again.
      </p>
      <Link href="/login" className="text-sm font-medium underline underline-offset-4">
        Back to login
      </Link>
    </main>
  );
}

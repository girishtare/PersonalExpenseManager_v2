import { requireOwnerUser } from '@/lib/auth/dal';

export default async function DashboardPage() {
  const user = await requireOwnerUser();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Signed in as {user.email}</p>
    </main>
  );
}

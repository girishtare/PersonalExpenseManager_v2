'use client';

import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  display_name: string;
}

export function DashboardFilters({
  accounts,
  start,
  end,
  accountId,
}: {
  accounts: Account[];
  start: string;
  end: string;
  accountId: string;
}) {
  const router = useRouter();

  function update(next: Partial<{ start: string; end: string; accountId: string }>) {
    const params = new URLSearchParams({
      start: next.start ?? start,
      end: next.end ?? end,
      accountId: next.accountId ?? accountId,
    });
    if (!params.get('accountId')) params.delete('accountId');
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Start date</span>
        <input
          type="date"
          defaultValue={start}
          max={end}
          onChange={(e) => update({ start: e.target.value })}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">End date</span>
        <input
          type="date"
          defaultValue={end}
          min={start}
          onChange={(e) => update({ end: e.target.value })}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Account</span>
        <select
          defaultValue={accountId}
          onChange={(e) => update({ accountId: e.target.value })}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.display_name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

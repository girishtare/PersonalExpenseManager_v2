'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/date-range-picker';

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
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Date range</span>
        <DateRangePicker start={start} end={end} onChange={(s, e) => update({ start: s, end: e })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Account</span>
        <Select
          items={[{ value: 'all', label: 'All accounts' }, ...accounts.map((a) => ({ value: a.id, label: a.display_name }))]}
          value={accountId || 'all'}
          onValueChange={(value) => update({ accountId: !value || value === 'all' ? '' : value })}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

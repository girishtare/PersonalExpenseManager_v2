'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker, toDateKey } from '@/components/date-range-picker';

interface Account {
  id: string;
  display_name: string;
}

/** Last 24 calendar months (most recent first), as "jump to this month" quick-select options. */
function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  });
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

  const today = new Date();

  function jumpToMonth(value: string) {
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const clampedEnd = monthEnd > today ? today : monthEnd;
    update({ start: toDateKey(monthStart), end: toDateKey(clampedEnd) });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Jump to month</span>
        <Select<string> items={monthOptions()} onValueChange={(value) => value && jumpToMonth(value)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select month..." />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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

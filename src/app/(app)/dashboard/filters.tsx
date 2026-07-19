'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker, toDateKey } from '@/components/date-range-picker';

interface Account {
  id: string;
  display_name: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DashboardFilters({
  accounts,
  start,
  end,
  accountId,
  earliestYear,
}: {
  accounts: Account[];
  start: string;
  end: string;
  accountId: string;
  /** Year of the earliest transaction on record - the Year dropdown only goes back this far. */
  earliestYear: number;
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
  const [jumpMonth, setJumpMonth] = useState(today.getMonth() + 1);
  const [jumpYear, setJumpYear] = useState(today.getFullYear());
  const years = Array.from({ length: today.getFullYear() - earliestYear + 1 }, (_, i) => today.getFullYear() - i);

  function jumpTo(year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const clampedEnd = monthEnd > today ? today : monthEnd;
    update({ start: toDateKey(monthStart), end: toDateKey(clampedEnd) });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Jump to month</span>
        <Select<string>
          items={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
          value={String(jumpMonth)}
          onValueChange={(value) => {
            if (!value) return;
            const month = Number(value);
            setJumpMonth(month);
            jumpTo(jumpYear, month);
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Year</span>
        <Select<string>
          items={years.map((y) => ({ value: String(y), label: String(y) }))}
          value={String(jumpYear)}
          onValueChange={(value) => {
            if (!value) return;
            const year = Number(value);
            setJumpYear(year);
            jumpTo(year, jumpMonth);
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
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

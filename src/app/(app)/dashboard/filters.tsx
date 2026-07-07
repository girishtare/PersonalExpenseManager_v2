'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  display_name: string;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [open, setOpen] = useState(false);
  const range: DateRange = { from: parseDateKey(start), to: parseDateKey(end) };

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-9 justify-start gap-2 font-normal')}>
            <CalendarIcon className="h-4 w-4" />
            {formatDisplay(range.from!)} &ndash; {formatDisplay(range.to!)}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <Calendar
              mode="range"
              defaultMonth={range.from}
              selected={range}
              onSelect={(newRange) => {
                if (newRange?.from) update({ start: toDateKey(newRange.from) });
                if (newRange?.to) update({ end: toDateKey(newRange.to) });
                if (newRange?.from && newRange?.to) setOpen(false);
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Account</span>
        <Select
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

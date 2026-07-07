'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateRangePicker } from '@/components/date-range-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Account {
  id: string;
  display_name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

type Filters = { start: string; end: string; account: string; category: string; direction: string; q: string };

export function TransactionsFilters({
  accounts,
  categories,
  start,
  end,
  account,
  category,
  direction,
  q,
}: Filters & { accounts: Account[]; categories: Category[] }) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(q);
  // Keep the box in sync if the URL changes from elsewhere (e.g. browser back/forward) -
  // adjusted during render rather than in an effect, per React's guidance for this pattern.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setSearchInput(q);
  }

  function update(next: Partial<Filters>) {
    const merged: Filters = { start, end, account, category, direction, q, ...next };
    const params = new URLSearchParams();
    if (merged.start) params.set('start', merged.start);
    if (merged.end) params.set('end', merged.end);
    if (merged.account) params.set('account', merged.account);
    if (merged.category) params.set('category', merged.category);
    if (merged.direction) params.set('direction', merged.direction);
    if (merged.q) params.set('q', merged.q);
    params.set('page', '1');
    router.push(`/transactions?${params.toString()}`);
  }

  // Debounce free-text search so we don't navigate on every keystroke.
  useEffect(() => {
    if (searchInput === q) return;
    const timeout = setTimeout(() => update({ q: searchInput }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Search</span>
        <Input
          placeholder="Search description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Date range</span>
        <DateRangePicker
          start={start}
          end={end}
          onChange={(s, e) => update({ start: s, end: e })}
          onClear={() => update({ start: '', end: '' })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Account</span>
        <Select
          items={[{ value: 'all', label: 'All accounts' }, ...accounts.map((a) => ({ value: a.id, label: a.display_name }))]}
          value={account || 'all'}
          onValueChange={(v) => update({ account: !v || v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Category</span>
        <Select
          items={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          value={category || 'all'}
          onValueChange={(v) => update({ category: !v || v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Direction</span>
        <Select
          items={{ all: 'All', debit: 'Debit', credit: 'Credit' }}
          value={direction || 'all'}
          onValueChange={(v) => update({ direction: !v || v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

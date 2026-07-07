'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CategoryPicker } from './category-picker';

interface Account {
  id: string;
  display_name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export interface TransactionRow {
  id: string;
  txn_date: string;
  description_raw: string;
  amount: number;
  direction: 'debit' | 'credit';
  category_id: string;
  account_id: string;
  account_name: string;
}

type SortColumn = 'txn_date' | 'description_raw' | 'account_name' | 'amount' | 'category_name';
type SortDirection = 'asc' | 'desc';

const formatAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

function SortHeader({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-foreground">
      {children}
      {active ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export function TransactionsTable({
  transactions,
  categories,
  accounts,
}: {
  transactions: TransactionRow[];
  categories: Category[];
  accounts: Account[];
}) {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('txn_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  const rows = useMemo(() => {
    let result = transactions;

    const q = search.trim().toLowerCase();
    if (q) result = result.filter((t) => t.description_raw.toLowerCase().includes(q));
    if (accountFilter !== 'all') result = result.filter((t) => t.account_id === accountFilter);
    if (categoryFilter !== 'all') result = result.filter((t) => t.category_id === categoryFilter);
    if (directionFilter !== 'all') result = result.filter((t) => t.direction === directionFilter);

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'txn_date':
          cmp = a.txn_date.localeCompare(b.txn_date);
          break;
        case 'description_raw':
          cmp = a.description_raw.localeCompare(b.description_raw);
          break;
        case 'account_name':
          cmp = a.account_name.localeCompare(b.account_name);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'category_name':
          cmp = (categoryNameById.get(a.category_id) ?? '').localeCompare(categoryNameById.get(b.category_id) ?? '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [transactions, search, accountFilter, categoryFilter, directionFilter, sortColumn, sortDirection, categoryNameById]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Search</span>
          <Input
            placeholder="Search description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Account</span>
          <Select
            items={[{ value: 'all', label: 'All accounts' }, ...accounts.map((a) => ({ value: a.id, label: a.display_name }))]}
            value={accountFilter}
            onValueChange={(v) => v && setAccountFilter(v)}
          >
            <SelectTrigger className="w-48">
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
            value={categoryFilter}
            onValueChange={(v) => v && setCategoryFilter(v)}
          >
            <SelectTrigger className="w-48">
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
            value={directionFilter}
            onValueChange={(v) => v && setDirectionFilter(v)}
          >
            <SelectTrigger className="w-28">
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

      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'txn_date'}
                  direction={sortDirection}
                  onClick={() => toggleSort('txn_date')}
                >
                  Date
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'description_raw'}
                  direction={sortDirection}
                  onClick={() => toggleSort('description_raw')}
                >
                  Description
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'account_name'}
                  direction={sortDirection}
                  onClick={() => toggleSort('account_name')}
                >
                  Account
                </SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader active={sortColumn === 'amount'} direction={sortDirection} onClick={() => toggleSort('amount')}>
                  Amount
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'category_name'}
                  direction={sortDirection}
                  onClick={() => toggleSort('category_name')}
                >
                  Category
                </SortHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>{txn.txn_date}</TableCell>
                <TableCell className="max-w-xs truncate whitespace-normal">{txn.description_raw}</TableCell>
                <TableCell>{txn.account_name}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${txn.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-500' : ''}`}
                >
                  {txn.direction === 'credit' ? '+' : '-'}
                  {formatAmount(Number(txn.amount))}
                </TableCell>
                <TableCell>
                  <CategoryPicker transactionId={txn.id} categoryId={txn.category_id} categories={categories} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No transactions match these filters.</p>
      )}
    </div>
  );
}

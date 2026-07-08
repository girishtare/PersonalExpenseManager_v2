'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TxnType } from '@/lib/transactions/type';
import { bulkUpdateTransactionCategory } from './actions';
import { CategoryPicker } from './category-picker';
import { TxnTypePicker } from './txn-type-picker';

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
  txn_type_override: TxnType | null;
  category_txn_type: TxnType;
}

type SortColumn = 'txn_date' | 'description_raw' | 'amount';

const formatAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

function SortHeader({
  column,
  sortKey,
  sortDir,
  searchQuery,
  children,
}: {
  column: SortColumn;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  searchQuery: string;
  children: React.ReactNode;
}) {
  const active = sortKey === column;
  const nextDir = active && sortDir === 'asc' ? 'desc' : 'asc';
  const prefix = searchQuery ? `${searchQuery}&` : '';
  const href = `/transactions?${prefix}sort=${column}&dir=${nextDir}&page=1`;

  return (
    <Link href={href} className="flex items-center gap-1 hover:text-foreground">
      {children}
      {active ? (
        sortDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </Link>
  );
}

export function TransactionsTable({
  transactions,
  categories,
  sortKey,
  sortDir,
  searchQuery,
}: {
  transactions: TransactionRow[];
  categories: Category[];
  sortKey: string;
  sortDir: 'asc' | 'desc';
  searchQuery: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Selection is scoped to the rows currently on screen - reset it whenever the page's
  // transaction set changes (new page, new filters, a category update revalidating the list)
  // rather than in an effect, per React's guidance for adjusting state from props.
  const [prevIds, setPrevIds] = useState(() => transactions.map((t) => t.id).join(','));
  const currentIds = transactions.map((t) => t.id).join(',');
  if (currentIds !== prevIds) {
    setPrevIds(currentIds);
    setSelected(new Set());
  }

  const [bulkCategoryId, setBulkCategoryId] = useState<string | undefined>(undefined);
  const [applying, startApplying] = useTransition();

  const allSelected = transactions.length > 0 && transactions.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select
            items={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={bulkCategoryId}
            onValueChange={(v) => setBulkCategoryId(v ?? undefined)}
          >
            <SelectTrigger size="sm" className="w-56">
              <SelectValue placeholder="Choose category..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Income</SelectLabel>
                {categories
                  .filter((c) => c.type === 'income')
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Expense</SelectLabel>
                {categories
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={!bulkCategoryId || applying}
            onClick={() =>
              startApplying(async () => {
                if (!bulkCategoryId) return;
                await bulkUpdateTransactionCategory([...selected], bulkCategoryId);
                setSelected(new Set());
                setBulkCategoryId(undefined);
              })
            }
          >
            Apply to {selected.size}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={applying} onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <span className="text-xs text-muted-foreground">Only affects the rows on this page.</span>
        </div>
      )}

      {transactions.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? new Set(transactions.map((t) => t.id)) : new Set())
                  }
                  aria-label="Select all rows on this page"
                />
              </TableHead>
              <TableHead>
                <SortHeader column="txn_date" sortKey={sortKey} sortDir={sortDir} searchQuery={searchQuery}>
                  Date
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader column="description_raw" sortKey={sortKey} sortDir={sortDir} searchQuery={searchQuery}>
                  Description
                </SortHeader>
              </TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">
                <SortHeader column="amount" sortKey={sortKey} sortDir={sortDir} searchQuery={searchQuery}>
                  Amount
                </SortHeader>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(txn.id)}
                    onCheckedChange={() => toggleSelected(txn.id)}
                    aria-label={`Select transaction ${txn.description_raw}`}
                  />
                </TableCell>
                <TableCell>{txn.txn_date}</TableCell>
                <TableCell className="max-w-xs truncate whitespace-normal">{txn.description_raw}</TableCell>
                <TableCell>{txn.account_name}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${txn.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-500' : ''}`}
                >
                  {txn.direction === 'credit' ? '+' : '-'}
                  {formatAmount(txn.amount)}
                </TableCell>
                <TableCell>
                  <CategoryPicker transactionId={txn.id} categoryId={txn.category_id} categories={categories} />
                </TableCell>
                <TableCell>
                  <TxnTypePicker
                    transactionId={txn.id}
                    txnTypeOverride={txn.txn_type_override}
                    categoryTxnType={txn.category_txn_type}
                  />
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

import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CategoryPicker } from './category-picker';

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
  return (
    <div className="flex flex-col gap-4">
      {transactions.length ? (
        <Table>
          <TableHeader>
            <TableRow>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
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

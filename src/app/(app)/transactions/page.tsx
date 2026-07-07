import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CategoryPicker } from './category-picker';

const formatAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

export default async function TransactionsPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, txn_date, description_raw, amount, direction, category_id, accounts(display_name)')
      .eq('user_id', user.id)
      .order('txn_date', { ascending: false })
      .limit(200),
    supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('sort_order', { ascending: true }),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Transactions</h1>

      {transactions?.length ? (
        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{txn.txn_date}</TableCell>
                  <TableCell className="max-w-xs truncate whitespace-normal">{txn.description_raw}</TableCell>
                  <TableCell>{(txn.accounts as unknown as { display_name: string } | null)?.display_name}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${txn.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-500' : ''}`}
                  >
                    {txn.direction === 'credit' ? '+' : '-'}
                    {formatAmount(Number(txn.amount))}
                  </TableCell>
                  <TableCell>
                    <CategoryPicker transactionId={txn.id} categoryId={txn.category_id} categories={categories ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No transactions yet - import a statement to get started.</p>
      )}
    </main>
  );
}

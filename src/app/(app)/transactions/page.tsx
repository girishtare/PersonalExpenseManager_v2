import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { TransactionsTable, type TransactionRow } from './transactions-table';

export default async function TransactionsPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const [{ data: transactions }, { data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, txn_date, description_raw, amount, direction, category_id, account_id, accounts(display_name)')
      .eq('user_id', user.id)
      .order('txn_date', { ascending: false })
      .limit(200),
    supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('name', { ascending: true }),
    supabase.from('accounts').select('id, display_name').eq('user_id', user.id).order('created_at', { ascending: true }),
  ]);

  const rows: TransactionRow[] = (transactions ?? []).map((t) => ({
    id: t.id,
    txn_date: t.txn_date,
    description_raw: t.description_raw,
    amount: Number(t.amount),
    direction: t.direction,
    category_id: t.category_id,
    account_id: t.account_id,
    account_name: (t.accounts as unknown as { display_name: string } | null)?.display_name ?? '',
  }));

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <Card className="p-4">
        <TransactionsTable transactions={rows} categories={categories ?? []} accounts={accounts ?? []} />
      </Card>
    </main>
  );
}

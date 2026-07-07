import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { CategoryPicker } from './category-picker';

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2">Category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 whitespace-nowrap">{txn.txn_date}</td>
                  <td className="py-2 pr-4">{txn.description_raw}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {(txn.accounts as unknown as { display_name: string }[] | null)?.[0]?.display_name}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right whitespace-nowrap ${
                      txn.direction === 'credit' ? 'text-green-600' : ''
                    }`}
                  >
                    {txn.direction === 'credit' ? '+' : '-'}
                    {txn.amount}
                  </td>
                  <td className="py-2">
                    <CategoryPicker transactionId={txn.id} categoryId={txn.category_id} categories={categories ?? []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No transactions yet - import a statement to get started.
        </p>
      )}
    </main>
  );
}

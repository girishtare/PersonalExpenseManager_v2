import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { AddAccountForm } from './add-account-form';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings: 'Savings',
  current: 'Current',
  credit_card: 'Credit Card',
};

export default async function AccountsPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, bank_code, account_type, display_name, last4')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Accounts</h1>

      <section className="flex flex-col gap-3">
        {accounts?.length ? (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{account.display_name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {account.bank_code} &middot; {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                    {account.last4 ? ` · ••${account.last4}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No accounts yet - add one below.</p>
        )}
      </section>

      <AddAccountForm />
    </main>
  );
}

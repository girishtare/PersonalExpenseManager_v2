import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
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

      <Card className="flex flex-col gap-3 p-4">
        {accounts?.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{account.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {account.bank_code} &middot; {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                    {account.last4 ? ` · ••${account.last4}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No accounts yet - add one below.</p>
        )}
      </Card>

      <AddAccountForm />
    </main>
  );
}

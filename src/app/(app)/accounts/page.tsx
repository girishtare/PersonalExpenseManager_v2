import Link from 'next/link';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AddAccountForm } from './add-account-form';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings: 'Savings',
  current: 'Current',
  credit_card: 'Credit Card',
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const { edit } = await searchParams;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, bank_code, account_type, display_name, last4')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const editingAccount = accounts?.find((a) => a.id === edit);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Accounts</h1>

      {accounts?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} href={`/accounts?edit=${account.id}`}>
              <Card
                className={cn(
                  'p-4 transition-colors hover:bg-muted',
                  account.id === editingAccount?.id && 'ring-2 ring-ring'
                )}
              >
                <p className="font-medium">{account.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {account.bank_code} &middot; {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                  {account.last4 ? ` · ••${account.last4}` : ''}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No accounts yet - add one below.</p>
      )}

      <AddAccountForm key={editingAccount?.id ?? 'create'} account={editingAccount} />
    </main>
  );
}

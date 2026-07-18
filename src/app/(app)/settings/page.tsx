import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DisconnectButton } from './disconnect-button';

const ROLES = [
  { role: 'live' as const, title: 'Live', description: 'The Gmail address that currently receives HDFC alert emails.' },
  {
    role: 'historical' as const,
    title: 'Historical',
    description: 'The old Gmail address that received alerts before you switched, for backfilling past transactions.',
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const { gmail_connected, gmail_error } = await searchParams;

  const { data: connections } = await supabase
    .from('email_connections')
    .select('id, email_address, role, last_synced_at')
    .eq('user_id', user.id);

  const connectionByRole = new Map((connections ?? []).map((c) => [c.role, c]));

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-medium">Gmail connections</h2>
          <p className="text-xs text-muted-foreground">
            Connects Gmail accounts so HDFC transaction-alert emails can be imported. Read-only access to the mailbox.
          </p>
        </div>

        {gmail_connected && (
          <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            Connected {gmail_connected}.
          </p>
        )}
        {gmail_error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Couldn&apos;t connect: {gmail_error}</p>
        )}

        <div className="flex flex-col gap-3">
          {ROLES.map(({ role, title, description }) => {
            const connection = connectionByRole.get(role);
            return (
              <div
                key={role}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  {connection && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Connected as <span className="font-medium text-foreground">{connection.email_address}</span>
                      {connection.last_synced_at
                        ? ` · last synced ${new Date(connection.last_synced_at).toLocaleString('en-IN')}`
                        : ' · not synced yet'}
                    </p>
                  )}
                </div>
                {connection ? (
                  <DisconnectButton connectionId={connection.id} />
                ) : (
                  <a href={`/api/gmail/connect?role=${role}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                    Connect Gmail
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}

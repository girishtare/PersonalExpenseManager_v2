import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DisconnectButton } from './disconnect-button';
import { SyncButton } from './sync-button';

/** "19-Jul-2026, 03:59:56 am" in IST, regardless of the server/viewer's own timezone. */
function formatIST(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}-${get('month')}-${get('year')}, ${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod').toLowerCase()}`;
}

const ROLES = [
  { role: 'live' as const, title: 'Live', description: 'The Gmail address that currently receives HDFC alert emails.' },
  {
    role: 'historical' as const,
    title: 'Historical',
    description: 'The old Gmail address that received alerts before you switched, for backfilling past transactions.',
  },
  {
    role: 'pre_historical' as const,
    title: 'Pre-Historical',
    description: 'An even older Gmail address that received HDFC alerts before the "Historical" one, for backfilling further back.',
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
    .select(
      'id, email_address, role, last_synced_at, sync_status, sync_processed, sync_total, sync_imported, sync_duplicates, sync_skipped, sync_unmatched_account, sync_error'
    )
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
            // markPaused() in /api/gmail/sync always starts the message this way - distinguishes
            // "stopped because the platform capped how far one run could get" (progress is real
            // and safe to resume) from a genuine error (revoked access, etc).
            const isPaused = connection?.sync_status === 'error' && connection.sync_error?.startsWith('Paused after');
            return (
              <div
                key={role}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  {connection && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <p>
                        Connected as <span className="font-medium text-foreground">{connection.email_address}</span>
                        {connection.sync_status === 'running'
                          ? ' · syncing…'
                          : connection.last_synced_at
                            ? ` · last synced ${formatIST(connection.last_synced_at)}`
                            : ' · not synced yet'}
                      </p>
                      {/* Shown on its own line, independent of last_synced_at - otherwise a
                          connection that completed a full sync once, then hit an error or the
                          platform-limit pause on a LATER run, would show a stale "last synced"
                          timestamp with no indication anything is wrong. */}
                      {connection.sync_status === 'error' && (
                        <p className={isPaused ? undefined : 'text-destructive'}>{connection.sync_error}</p>
                      )}
                    </div>
                  )}
                </div>
                {connection ? (
                  <div className="flex items-start gap-2">
                    <SyncButton
                      connectionId={connection.id}
                      initialStatus={{
                        status: connection.sync_status,
                        processed: connection.sync_processed,
                        total: connection.sync_total,
                        imported: connection.sync_imported,
                        duplicates: connection.sync_duplicates,
                        skipped: connection.sync_skipped,
                        unmatchedAccount: connection.sync_unmatched_account,
                        error: connection.sync_error,
                        lastSyncedAt: connection.last_synced_at,
                      }}
                    />
                    <DisconnectButton connectionId={connection.id} />
                  </div>
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

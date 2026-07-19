'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';

export interface DisconnectState {
  error?: string;
}

export async function disconnectGmail(connectionId: string): Promise<DisconnectState> {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const { error } = await supabase.from('email_connections').delete().eq('id', connectionId).eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  return {};
}

export interface SyncStatus {
  status: 'idle' | 'running' | 'error';
  processed: number;
  total: number;
  imported: number;
  duplicates: number;
  skipped: number;
  unmatchedAccount: number;
  error: string | null;
  lastSyncedAt: string | null;
}

/**
 * Polled by SyncButton while a sync is running - the sync itself continues server-side (see
 * /api/gmail/sync's self-chaining) regardless of whether anything is polling it, so this is
 * purely for the progress bar and works the same whether the user stayed on the page or came
 * back to it later mid-sync.
 */
export async function getConnectionSyncStatus(connectionId: string): Promise<SyncStatus | null> {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_connections')
    .select(
      'sync_status, sync_processed, sync_total, sync_imported, sync_duplicates, sync_skipped, sync_unmatched_account, sync_error, last_synced_at'
    )
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    status: data.sync_status,
    processed: data.sync_processed,
    total: data.sync_total,
    imported: data.sync_imported,
    duplicates: data.sync_duplicates,
    skipped: data.sync_skipped,
    unmatchedAccount: data.sync_unmatched_account,
    error: data.sync_error,
    lastSyncedAt: data.last_synced_at,
  };
}

/**
 * Polled by the app header's sync indicator (all pages, not just /settings) - true if any
 * connection is mid-sync, whether that run was started by a manual "Sync now" click or the
 * dashboard's 24h auto-trigger.
 */
export async function getAnySyncRunning(): Promise<boolean> {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const { data } = await supabase.from('email_connections').select('id').eq('user_id', user.id).eq('sync_status', 'running').limit(1);
  return (data?.length ?? 0) > 0;
}

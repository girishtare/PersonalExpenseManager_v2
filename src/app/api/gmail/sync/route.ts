import { NextResponse, after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { decrypt } from '@/lib/crypto/secret-box';
import { getMessage, listMessageIds, refreshAccessToken } from '@/lib/google/gmail';
import { parseHdfcAlertEmail } from '@/lib/email-adapters/hdfc/alert-parser';
import { computeDedupeHash } from '@/lib/transactions/dedupe';
import { categorizeTransaction, getUncategorizedCategoryId, loadActiveRules } from '@/lib/categorization/engine';

export const maxDuration = 60;

// HDFC migrated its InstaAlerts sender address at some point - old mail (e.g. a "historical"
// backfill mailbox) can still carry the .net address, current mail uses .bank.in. Search both.
const SENDERS = ['alerts@hdfcbank.bank.in', 'alerts@hdfcbank.net'];
const BATCH_SIZE = 20;

interface BatchResult {
  done: boolean;
  nextPageToken: string | null;
  resultSizeEstimate: number;
  processedThisBatch: number;
  imported: number;
  duplicates: number;
  skipped: number;
  unmatchedAccount: number;
}

async function processBatch(supabase: SupabaseClient, connectionId: string, pageToken: string | undefined): Promise<BatchResult> {
  const { data: connection } = await supabase
    .from('email_connections')
    .select(
      'id, user_id, refresh_token, last_synced_at, sync_processed, sync_total, sync_imported, sync_duplicates, sync_skipped, sync_unmatched_account'
    )
    .eq('id', connectionId)
    .maybeSingle();
  if (!connection) throw new Error('Connection not found.');

  const accessToken = await refreshAccessToken(decrypt(connection.refresh_token));

  let query = `(${SENDERS.map((s) => `from:${s}`).join(' OR ')})`;
  if (connection.last_synced_at) {
    query += ` after:${Math.floor(new Date(connection.last_synced_at).getTime() / 1000)}`;
  }

  const list = await listMessageIds({ accessToken, query, pageToken, maxResults: BATCH_SIZE });

  const [{ data: accounts }, rules, uncategorizedId] = await Promise.all([
    supabase.from('accounts').select('id, last4').eq('user_id', connection.user_id),
    loadActiveRules(supabase, connection.user_id),
    getUncategorizedCategoryId(supabase),
  ]);
  const accountIdByLast4 = new Map((accounts ?? []).filter((a) => a.last4).map((a) => [a.last4, a.id]));

  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  let unmatchedAccount = 0;
  const rowsToInsert = [];

  for (const messageId of list.ids) {
    const { bodyText } = await getMessage({ accessToken, messageId });
    const parsed = parseHdfcAlertEmail(bodyText);
    if (!parsed) {
      skipped++;
      continue;
    }

    const accountId = accountIdByLast4.get(parsed.last4);
    if (!accountId) {
      unmatchedAccount++;
      continue;
    }

    // Fuzzy cross-source dedup - a statement upload may already have this exact transaction
    // under completely different narration text, so an exact-hash check alone (below) can't
    // catch it. Same account/date/amount/direction is treated as "already have this".
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('account_id', accountId)
      .eq('txn_date', parsed.txnDate)
      .eq('amount', parsed.amount)
      .eq('direction', parsed.direction)
      .limit(1)
      .maybeSingle();
    if (existing) {
      duplicates++;
      continue;
    }

    // Falls back to the Gmail message id when the alert itself has no reference number (e.g.
    // the credit-card template), so two same-day/same-amount/same-merchant emails still hash
    // differently instead of colliding.
    const referenceNo = parsed.referenceNo ?? messageId;
    const { categoryId, ruleId } = categorizeTransaction(parsed.descriptionRaw, parsed.direction, rules, uncategorizedId);

    rowsToInsert.push({
      user_id: connection.user_id,
      account_id: accountId,
      statement_id: null,
      txn_date: parsed.txnDate,
      description_raw: parsed.descriptionRaw,
      amount: parsed.amount,
      direction: parsed.direction,
      category_id: categoryId,
      categorization_rule_id: ruleId,
      reference_no: referenceNo,
      dedupe_hash: computeDedupeHash({
        accountId,
        txnDate: parsed.txnDate,
        amount: parsed.amount,
        direction: parsed.direction,
        descriptionRaw: parsed.descriptionRaw,
        referenceNo,
      }),
    });
  }

  if (rowsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .upsert(rowsToInsert, { onConflict: 'account_id,dedupe_hash', ignoreDuplicates: true })
      .select('id');
    if (insertError) throw new Error(`Could not save transactions: ${insertError.message}`);
    imported = inserted?.length ?? 0;
    duplicates += rowsToInsert.length - imported;
  }

  const done = !list.nextPageToken;
  const processedSoFar = (connection.sync_processed ?? 0) + list.ids.length;

  await supabase
    .from('email_connections')
    .update({
      sync_status: done ? 'idle' : 'running',
      sync_processed: processedSoFar,
      sync_total: Math.max(list.resultSizeEstimate, processedSoFar),
      sync_imported: (connection.sync_imported ?? 0) + imported,
      sync_duplicates: (connection.sync_duplicates ?? 0) + duplicates,
      sync_skipped: (connection.sync_skipped ?? 0) + skipped,
      sync_unmatched_account: (connection.sync_unmatched_account ?? 0) + unmatchedAccount,
      sync_error: null,
      ...(done ? { last_synced_at: new Date().toISOString() } : {}),
    })
    .eq('id', connectionId);

  return {
    done,
    nextPageToken: list.nextPageToken ?? null,
    resultSizeEstimate: list.resultSizeEstimate,
    processedThisBatch: list.ids.length,
    imported,
    duplicates,
    skipped,
    unmatchedAccount,
  };
}

async function markFailed(connectionId: string, message: string) {
  const supabase = createServiceClient();
  await supabase.from('email_connections').update({ sync_status: 'error', sync_error: message }).eq('id', connectionId);
}

export async function POST(request: Request) {
  const isInternal = request.headers.get('authorization') === `Bearer ${process.env.INTERNAL_SYNC_SECRET}`;

  const body = await request.json().catch(() => ({}));
  const connectionId = body.connectionId;
  const pageToken = typeof body.pageToken === 'string' ? body.pageToken : undefined;
  if (typeof connectionId !== 'string') {
    return NextResponse.json({ error: 'connectionId is required.' }, { status: 400 });
  }

  let supabase: SupabaseClient;
  if (isInternal) {
    // Every subsequent link in a sync chain is this server calling itself (see the after()
    // block below) - it only ever continues a connectionId the original user-initiated call
    // already validated ownership of, so it's safe to use the service client here.
    supabase = createServiceClient();
  } else {
    const user = await requireOwnerUser();
    const cookieClient = await createClient();
    const { data: owned } = await cookieClient.from('email_connections').select('id, sync_status').eq('id', connectionId).eq('user_id', user.id).maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });
    if (!pageToken) {
      if (owned.sync_status === 'running') {
        return NextResponse.json({ error: 'A sync is already in progress for this connection.' }, { status: 409 });
      }
      // A fresh start (not a continuation) - reset progress so it doesn't accumulate on top of
      // whatever an earlier completed or errored run left behind.
      await cookieClient
        .from('email_connections')
        .update({
          sync_status: 'running',
          sync_processed: 0,
          sync_total: 0,
          sync_imported: 0,
          sync_duplicates: 0,
          sync_skipped: 0,
          sync_unmatched_account: 0,
          sync_error: null,
        })
        .eq('id', connectionId);
    }
    supabase = cookieClient;
  }

  let result: BatchResult;
  try {
    result = await processBatch(supabase, connectionId, pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.';
    await markFailed(connectionId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!result.done) {
    // Keep going server-side via a genuine new invocation (its own fresh time budget) rather
    // than looping in-process, so the sync survives the user navigating away or closing the
    // tab entirely - it isn't tied to this request's lifetime at all past this point.
    const origin = new URL(request.url).origin;
    const nextPageToken = result.nextPageToken;
    after(async () => {
      try {
        const res = await fetch(`${origin}/api/gmail/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INTERNAL_SYNC_SECRET}` },
          body: JSON.stringify({ connectionId, pageToken: nextPageToken }),
        });
        if (!res.ok) await markFailed(connectionId, `Sync chain broke (status ${res.status}).`);
      } catch (err) {
        await markFailed(connectionId, err instanceof Error ? err.message : 'Sync chain broke.');
      }
    });
  }

  return NextResponse.json(result);
}

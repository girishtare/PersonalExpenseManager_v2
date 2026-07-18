import { NextResponse } from 'next/server';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
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

export async function POST(request: Request) {
  const user = await requireOwnerUser();
  const body = await request.json().catch(() => ({}));
  const connectionId = body.connectionId;
  const pageToken = typeof body.pageToken === 'string' ? body.pageToken : undefined;
  if (typeof connectionId !== 'string') {
    return NextResponse.json({ error: 'connectionId is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from('email_connections')
    .select('id, email_address, refresh_token, last_synced_at')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decrypt(connection.refresh_token));
  } catch {
    return NextResponse.json({ error: 'Gmail access was revoked or expired - disconnect and reconnect this account.' }, { status: 401 });
  }

  let query = `(${SENDERS.map((s) => `from:${s}`).join(' OR ')})`;
  if (connection.last_synced_at) {
    query += ` after:${Math.floor(new Date(connection.last_synced_at).getTime() / 1000)}`;
  }

  const list = await listMessageIds({ accessToken, query, pageToken, maxResults: BATCH_SIZE });

  const [{ data: accounts }, rules, uncategorizedId] = await Promise.all([
    supabase.from('accounts').select('id, last4').eq('user_id', user.id),
    loadActiveRules(supabase, user.id),
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
      user_id: user.id,
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
    if (insertError) {
      return NextResponse.json({ error: `Could not save transactions: ${insertError.message}` }, { status: 500 });
    }
    imported = inserted?.length ?? 0;
    duplicates += rowsToInsert.length - imported;
  }

  const done = !list.nextPageToken;
  if (done) {
    await supabase.from('email_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connectionId);
  }

  return NextResponse.json({
    done,
    nextPageToken: list.nextPageToken ?? null,
    resultSizeEstimate: list.resultSizeEstimate,
    processedThisBatch: list.ids.length,
    imported,
    duplicates,
    skipped,
    unmatchedAccount,
  });
}

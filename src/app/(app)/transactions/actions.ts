'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { reduceDescription } from '@/lib/transactions/similar';
import type { TxnType } from '@/lib/transactions/type';

const TXN_TYPES: TxnType[] = ['expense', 'income', 'transfer', 'investment'];

/** Sets or clears (null = "use the category's default") this transaction's txn_type_override. */
export async function updateTransactionTxnTypeOverride(transactionId: string, txnType: TxnType | null) {
  const user = await requireOwnerUser();
  if (txnType !== null && !TXN_TYPES.includes(txnType)) throw new Error('Invalid transaction type.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('transactions')
    .update({ txn_type_override: txnType })
    .eq('id', transactionId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export async function updateTransactionCategory(transactionId: string, categoryId: string) {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId, is_manual_override: true, categorization_rule_id: null })
    .eq('id', transactionId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export interface SimilarTransaction {
  id: string;
  txn_date: string;
  description_raw: string;
  amount: number;
  direction: 'debit' | 'credit';
  category_id: string;
}

/**
 * Finds other transactions whose narration reduces to the same "core" text as the given
 * transaction's (see reduceDescription) - i.e. likely the same recurring merchant/counterparty -
 * excluding ones already tagged with the category the user just picked. Called BEFORE the
 * transaction is actually updated (a pure read, no revalidatePath), so the UI can show the
 * "apply to similar?" dialog and only commit any writes once the user responds - committing
 * first would trigger a page refresh that could race with (and drop) the dialog's pending state.
 */
export async function findSimilarTransactions(transactionId: string, newCategoryId: string): Promise<SimilarTransaction[]> {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from('transactions')
    .select('description_raw, direction')
    .eq('id', transactionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!target) return [];

  const targetKey = reduceDescription(target.description_raw);
  // Too short to be a reliable merchant/counterparty signature - skip to avoid false-positive matches.
  if (targetKey.length < 4) return [];

  const { data: candidates } = await supabase
    .from('transactions')
    .select('id, txn_date, description_raw, amount, direction, category_id')
    .eq('user_id', user.id)
    .eq('direction', target.direction)
    .neq('id', transactionId)
    .neq('category_id', newCategoryId)
    .order('txn_date', { ascending: false })
    .limit(2000);

  return (candidates ?? [])
    .filter((t) => reduceDescription(t.description_raw) === targetKey)
    .map((t) => ({ ...t, amount: Number(t.amount) }));
}

/**
 * Sets (or, given an empty name, clears) the display name for every transaction whose narration
 * reduces to this merchant key - a pure display override, description_raw is untouched.
 */
export async function setMerchantAlias(merchantKey: string, displayName: string) {
  const user = await requireOwnerUser();
  const trimmed = displayName.trim();
  const supabase = await createClient();

  const { error } = trimmed
    ? await supabase
        .from('merchant_aliases')
        .upsert({ user_id: user.id, merchant_key: merchantKey, display_name: trimmed }, { onConflict: 'user_id,merchant_key' })
    : await supabase.from('merchant_aliases').delete().eq('user_id', user.id).eq('merchant_key', merchantKey);

  if (error) throw new Error(error.message);

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export async function bulkUpdateTransactionCategory(transactionIds: string[], categoryId: string) {
  const user = await requireOwnerUser();
  if (transactionIds.length === 0) return;
  const supabase = await createClient();

  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId, is_manual_override: true, categorization_rule_id: null })
    .in('id', transactionIds)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

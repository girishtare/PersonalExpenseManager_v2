'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { reduceDescription } from '@/lib/transactions/similar';

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
 * excluding ones already tagged with its current category. Called right after a manual
 * re-categorization so the UI can offer to apply the same change to the rest of them.
 */
export async function findSimilarTransactions(transactionId: string): Promise<SimilarTransaction[]> {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from('transactions')
    .select('description_raw, direction, category_id')
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
    .neq('category_id', target.category_id)
    .order('txn_date', { ascending: false })
    .limit(2000);

  return (candidates ?? [])
    .filter((t) => reduceDescription(t.description_raw) === targetKey)
    .map((t) => ({ ...t, amount: Number(t.amount) }));
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

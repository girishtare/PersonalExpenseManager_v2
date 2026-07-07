'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { categorizeTransaction, getUncategorizedCategoryId, loadActiveRules } from '@/lib/categorization/engine';

const AddCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  type: z.enum(['income', 'expense']),
});

export interface AddCategoryState {
  error?: string;
}

export async function createCategory(
  _prevState: AddCategoryState | undefined,
  formData: FormData
): Promise<AddCategoryState> {
  const user = await requireOwnerUser();
  const parsed = AddCategorySchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
  });
  if (error) return { error: error.message };

  revalidatePath('/categories');
  return {};
}

const AddRuleSchema = z.object({
  categoryId: z.string().uuid(),
  pattern: z.string().trim().min(1, 'Pattern is required').max(100),
  matchType: z.enum(['contains', 'starts_with', 'exact', 'regex']),
  direction: z.enum(['debit', 'credit', 'any']),
  priority: z.coerce.number().int().min(1).max(1000),
});

export interface AddRuleState {
  error?: string;
}

export async function createRule(_prevState: AddRuleState | undefined, formData: FormData): Promise<AddRuleState> {
  const user = await requireOwnerUser();
  const parsed = AddRuleSchema.safeParse({
    categoryId: formData.get('categoryId'),
    pattern: formData.get('pattern'),
    matchType: formData.get('matchType'),
    direction: formData.get('direction'),
    priority: formData.get('priority'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categorization_rules').insert({
    user_id: user.id,
    category_id: parsed.data.categoryId,
    pattern: parsed.data.pattern,
    match_type: parsed.data.matchType,
    direction: parsed.data.direction === 'any' ? null : parsed.data.direction,
    priority: parsed.data.priority,
  });
  if (error) return { error: error.message };

  revalidatePath('/categories');
  return {};
}

export async function deleteRule(ruleId: string) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  // RLS also scopes deletes to user_id = auth.uid(), so this is a no-op against system rules.
  await supabase.from('categorization_rules').delete().eq('id', ruleId).eq('user_id', user.id);
  revalidatePath('/categories');
}

export async function recalculateCategories(): Promise<{ updatedCount: number } | { error: string }> {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const rules = await loadActiveRules(supabase, user.id);
  const uncategorizedId = await getUncategorizedCategoryId(supabase);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, description_raw, direction')
    .eq('user_id', user.id)
    .eq('is_manual_override', false);

  if (error || !transactions) {
    return { error: error?.message ?? 'Could not load transactions' };
  }

  let updatedCount = 0;
  for (const txn of transactions) {
    const { categoryId, ruleId } = categorizeTransaction(txn.description_raw, txn.direction, rules, uncategorizedId);
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ category_id: categoryId, categorization_rule_id: ruleId })
      .eq('id', txn.id);
    if (!updateError) updatedCount++;
  }

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { updatedCount };
}

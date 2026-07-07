'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categorizeTransaction, getUncategorizedCategoryId, loadActiveRules } from '@/lib/categorization/engine';

// The import pipeline finds its fallback bucket by name (see getUncategorizedCategoryId) -
// renaming or deleting it would silently break every future statement import.
const UNCATEGORIZED_NAME_RE = /^uncategori[sz]ed$/i;

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

export interface CategoryActionState {
  error?: string;
}

export async function updateCategory(categoryId: string, name: string): Promise<CategoryActionState> {
  await requireOwnerUser();
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    return { error: 'Name must be 1-60 characters.' };
  }

  const supabase = await createClient();
  const { data: category } = await supabase.from('categories').select('user_id, name').eq('id', categoryId).maybeSingle();
  if (!category) return { error: 'Category not found.' };
  if (!category.user_id && UNCATEGORIZED_NAME_RE.test(category.name)) {
    return { error: 'The "Uncategorized" category is used internally by imports and can\'t be renamed.' };
  }

  // System categories (user_id null) are read-only under RLS, so use the service-role
  // client for those - safe here since requireOwnerUser() already gated this call to
  // the single allowed owner.
  const client = category.user_id ? supabase : createServiceClient();
  const { error } = await client.from('categories').update({ name: trimmed }).eq('id', categoryId);
  if (error) return { error: error.message };

  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return {};
}

export async function deleteCategory(categoryId: string): Promise<CategoryActionState> {
  await requireOwnerUser();
  const supabase = await createClient();
  const { data: category } = await supabase.from('categories').select('user_id, name').eq('id', categoryId).maybeSingle();
  if (!category) return { error: 'Category not found.' };
  if (!category.user_id && UNCATEGORIZED_NAME_RE.test(category.name)) {
    return { error: 'The "Uncategorized" category is used internally by imports and can\'t be deleted.' };
  }

  const client = category.user_id ? supabase : createServiceClient();
  const { error } = await client.from('categories').delete().eq('id', categoryId);
  if (error) {
    // Postgres FK violation - category is still referenced by a rule or transaction.
    if (error.code === '23503') {
      return { error: 'This category is still used by a rule or transaction - reassign those first.' };
    }
    return { error: error.message };
  }

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

export async function updateRuleCategory(
  rule: { id: string; userId: string | null; pattern: string; matchType: string; direction: string | null; priority: number },
  categoryId: string
) {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  if (rule.userId) {
    // Your own rule - update it directly (RLS also scopes this to user_id = auth.uid()).
    await supabase.from('categorization_rules').update({ category_id: categoryId }).eq('id', rule.id).eq('user_id', user.id);
  } else {
    // System rules are shared and read-only (RLS blocks writes to user_id-null rows), so
    // "editing" one clones it as your own override at a higher priority instead - same
    // pattern as the "always categorize like this" override from the transactions list.
    await supabase.from('categorization_rules').insert({
      user_id: user.id,
      category_id: categoryId,
      pattern: rule.pattern,
      match_type: rule.matchType,
      direction: rule.direction,
      priority: Math.max(1, rule.priority - 1),
      created_from_override: true,
    });
  }

  revalidatePath('/categories');
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

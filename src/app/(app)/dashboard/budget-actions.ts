'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { toDateKey } from '@/lib/dashboard/period';

export interface BudgetActionState {
  error?: string;
}

/**
 * Sets the budget for a category effective today. Uses effective_from=today so editing the
 * same category again later the same day updates this row (unique on user_id/category_id/
 * effective_from) rather than creating a duplicate, while still preserving history across days.
 */
export async function upsertBudget(categoryId: string, monthlyAmount: number): Promise<BudgetActionState> {
  const user = await requireOwnerUser();
  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    return { error: 'Budget must be a non-negative number.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('budgets').upsert(
    {
      user_id: user.id,
      category_id: categoryId,
      monthly_amount: monthlyAmount,
      effective_from: toDateKey(new Date()),
    },
    { onConflict: 'user_id,category_id,effective_from' }
  );
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return {};
}

'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';

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
}

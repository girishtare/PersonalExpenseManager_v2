'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { BANK_CODES } from '@/lib/banks';

const AddAccountSchema = z.object({
  bankCode: z.enum(BANK_CODES),
  accountType: z.enum(['savings', 'current', 'credit_card']),
  displayName: z.string().trim().min(1, 'Name is required').max(100),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Must be exactly 4 digits')
    .optional()
    .or(z.literal('')),
});

export interface AddAccountState {
  error?: string;
}

export async function createAccount(_prevState: AddAccountState | undefined, formData: FormData): Promise<AddAccountState> {
  const user = await requireOwnerUser();

  const parsed = AddAccountSchema.safeParse({
    bankCode: formData.get('bankCode'),
    accountType: formData.get('accountType'),
    displayName: formData.get('displayName'),
    last4: formData.get('last4'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('accounts').insert({
    user_id: user.id,
    bank_code: parsed.data.bankCode,
    account_type: parsed.data.accountType,
    display_name: parsed.data.displayName,
    last4: parsed.data.last4 || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/accounts');
  return {};
}

const UpdateAccountSchema = AddAccountSchema.extend({
  id: z.string().uuid(),
});

export async function updateAccount(
  _prevState: AddAccountState | undefined,
  formData: FormData
): Promise<AddAccountState> {
  const user = await requireOwnerUser();

  const parsed = UpdateAccountSchema.safeParse({
    id: formData.get('id'),
    bankCode: formData.get('bankCode'),
    accountType: formData.get('accountType'),
    displayName: formData.get('displayName'),
    last4: formData.get('last4'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update({
      bank_code: parsed.data.bankCode,
      account_type: parsed.data.accountType,
      display_name: parsed.data.displayName,
      last4: parsed.data.last4 || null,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/accounts');
  redirect('/accounts');
}

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

import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { UploadForm } from './upload-form';

export default async function ImportPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, display_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Import statement</h1>
      <UploadForm accounts={accounts ?? []} />
    </main>
  );
}

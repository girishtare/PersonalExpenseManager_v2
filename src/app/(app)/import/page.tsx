import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { ImportHistoryTable, type ImportHistoryRow } from './import-history-table';
import { UploadForm } from './upload-form';

export default async function ImportPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const [{ data: accounts }, { data: statements }] = await Promise.all([
    supabase.from('accounts').select('id, display_name').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase
      .from('statements')
      .select('id, file_name, source_format, parse_status, transactions_imported_count, transactions_duplicate_count, created_at, accounts(display_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const historyRows: ImportHistoryRow[] = (statements ?? []).map((s) => ({
    id: s.id,
    file_name: s.file_name,
    account_name: (s.accounts as unknown as { display_name: string } | null)?.display_name ?? '',
    source_format: s.source_format,
    parse_status: s.parse_status,
    transactions_imported_count: s.transactions_imported_count,
    transactions_duplicate_count: s.transactions_duplicate_count,
    created_at: s.created_at,
  }));

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Import statement</h1>
      <UploadForm accounts={accounts ?? []} />

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Import history</h2>
        <ImportHistoryTable rows={historyRows} />
      </Card>
    </main>
  );
}

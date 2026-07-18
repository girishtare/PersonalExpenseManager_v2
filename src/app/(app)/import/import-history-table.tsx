import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface ImportHistoryRow {
  id: string;
  file_name: string;
  account_name: string;
  source_format: string;
  parse_status: string;
  transactions_imported_count: number;
  transactions_duplicate_count: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  parsed: 'Parsed',
  partially_parsed: 'Partially parsed',
  failed: 'Failed',
};

export function ImportHistoryTable({ rows }: { rows: ImportHistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No imports yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Imported</TableHead>
          <TableHead className="text-right">Duplicates</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString('en-IN')}</TableCell>
            <TableCell>{row.account_name}</TableCell>
            <TableCell className="max-w-xs truncate" title={row.file_name}>
              {row.file_name}
            </TableCell>
            <TableCell className="uppercase">{row.source_format}</TableCell>
            <TableCell className={row.parse_status === 'failed' ? 'text-destructive' : undefined}>
              {STATUS_LABELS[row.parse_status] ?? row.parse_status}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.transactions_imported_count}</TableCell>
            <TableCell className="text-right tabular-nums">{row.transactions_duplicate_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

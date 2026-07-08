import type { MerchantDelta } from '@/lib/dashboard/merchants';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function TopMerchantsTable({ rows }: { rows: MerchantDelta[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expense data for this period yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2 font-medium">Merchant</th>
            <th className="pb-2 text-right font-medium">This period</th>
            <th className="pb-2 text-right font-medium">Same days last month</th>
            <th className="pb-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="max-w-xs truncate py-2" title={row.name}>
                {row.name}
              </td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(row.current)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(row.previous)}</td>
              <td
                className={`py-2 text-right tabular-nums font-medium ${
                  row.delta > 0 ? 'text-destructive' : row.delta < 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                {row.delta > 0 ? '+' : ''}
                {formatCurrency(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

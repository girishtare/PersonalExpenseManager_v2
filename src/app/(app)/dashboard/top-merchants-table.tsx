import type { MerchantDelta } from '@/lib/dashboard/merchants';
import { MerchantNameCell } from '@/components/merchant-name-cell';
import { Sparkline } from './sparkline';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

type MerchantRow = MerchantDelta & { aliasName: string | null; trend: { month: string; amount: number }[] };

export function TopMerchantsTable({ rows }: { rows: MerchantRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expense data for this period yet.</p>;
  }

  // Every row carries the same set of extra comparison periods, in the same order - safe to
  // read the labels off the first row for the header.
  const historyLabels = rows[0].history.map((h) => h.label);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2 font-medium">Merchant</th>
            <th className="pb-2 text-right font-medium">This period</th>
            <th className="pb-2 text-right font-medium">Same days last month</th>
            {historyLabels.map((label) => (
              <th key={label} className="pb-2 text-right font-medium">
                Same days {label}
              </th>
            ))}
            <th className="pb-2 text-right font-medium">Change</th>
            <th className="pb-2 pl-3 text-left font-medium">Last months</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="py-2">
                <MerchantNameCell merchantKey={row.key} descriptionRaw={row.name} aliasName={row.aliasName} />
              </td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(row.current)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(row.previous)}</td>
              {row.history.map((h) => (
                <td key={h.label} className="py-2 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(h.amount)}
                </td>
              ))}
              <td
                className={`py-2 text-right tabular-nums font-medium ${
                  row.delta > 0 ? 'text-destructive' : row.delta < 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                {row.delta > 0 ? '+' : ''}
                {formatCurrency(row.delta)}
              </td>
              <td className="py-2 pl-3">
                <Sparkline months={row.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

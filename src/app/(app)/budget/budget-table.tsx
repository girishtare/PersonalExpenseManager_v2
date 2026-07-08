import { BudgetCell } from './budget-cell';

export interface BudgetRow {
  categoryId: string;
  categoryName: string;
  budget: number;
  spent: number;
  /** Linear month-end projection - always computable (degenerates to `spent` at month-end). */
  projected: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expense categories yet.</p>;
  }

  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Category</th>
            <th className="py-2 text-right font-medium">Spent</th>
            <th className="py-2 text-right font-medium">Projected</th>
            <th className="py-2 text-right font-medium">Budget</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOverrun = row.budget > 0 && row.projected > row.budget;
            return (
              <tr key={row.categoryId} className={`border-b border-border last:border-0 ${isOverrun ? 'bg-destructive/5' : ''}`}>
                <td className="py-2 pr-3 font-medium">{row.categoryName}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(row.spent)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${isOverrun ? 'text-destructive' : ''}`}>
                  {formatCurrency(row.projected)}
                  {isOverrun && ' – over budget'}
                </td>
                <td className="py-2">
                  <BudgetCell categoryId={row.categoryId} amount={row.budget} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

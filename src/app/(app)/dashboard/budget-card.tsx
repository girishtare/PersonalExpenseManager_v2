import { BudgetInput } from './budget-input';

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

export function BudgetCard({ rows }: { rows: BudgetRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expense categories yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const isOverrun = row.budget > 0 && row.projected > row.budget;
        return (
          <div
            key={row.categoryId}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
              isOverrun ? 'border-destructive/40 bg-destructive/5' : 'border-border'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{row.categoryName}</p>
              <p className={`text-xs ${isOverrun ? 'text-destructive' : 'text-muted-foreground'}`}>
                Spent {formatCurrency(row.spent)}
                {Math.round(row.projected) !== Math.round(row.spent) && <> &middot; projected {formatCurrency(row.projected)}</>}
                {isOverrun && ' - over budget'}
              </p>
            </div>
            <BudgetInput categoryId={row.categoryId} initialAmount={row.budget} />
          </div>
        );
      })}
    </div>
  );
}

import type { UpcomingDebit } from '@/lib/dashboard/recurrence';
import { parseDateKey } from '@/lib/dashboard/period';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function formatDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function UpcomingDebitsCard({ debits }: { debits: UpcomingDebit[] }) {
  if (debits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recurring debits detected yet - needs at least 3 monthly occurrences of a consistent payment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {debits.map((d) => (
        <li key={d.descriptionKey} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={d.sampleDescription}>
              {d.sampleDescription}
            </p>
            <p className="text-xs text-muted-foreground">
              Expected {formatDate(d.expectedDate)} &middot; seen {d.occurrences} times
            </p>
          </div>
          <span className="shrink-0 text-right text-sm font-medium tabular-nums">
            {formatCurrency(d.expectedAmount)}
            {d.isEstimate && <span className="block text-[10px] font-normal text-muted-foreground">avg, varies</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

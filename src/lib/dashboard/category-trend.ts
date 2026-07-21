import { categoryOf } from '../transactions/aggregate';
import { effectiveTxnType, type TxnType } from '../transactions/type';

export interface CategoryTrendTxn {
  amount: number;
  txn_date: string;
  txn_type_override: TxnType | null;
  category_id: string;
  categories: { name: string; txn_type: TxnType }[] | { name: string; txn_type: TxnType } | null;
}

export interface MonthBucket {
  startKey: string;
  endKey: string;
  label: string;
}

export interface CategoryMonthlyTrend {
  categoryId: string;
  categoryName: string;
  /** One point per bucket in the same order as the input monthBuckets, zero-filled for months
   * with no spend so a chart can show a continuous, complete series. */
  months: { month: string; amount: number }[];
}

/**
 * Buckets 12 months of transactions into a per-category monthly expense series - the same
 * effective-type resolution used everywhere else (aggregateByCategory, the trend chart), so a
 * txn_type_override is honored and transfers/investments are excluded.
 */
export function computeCategoryMonthlyTrend(rows: CategoryTrendTxn[], monthBuckets: MonthBucket[]): CategoryMonthlyTrend[] {
  const byCategory = new Map<string, { name: string; monthTotals: Map<number, number> }>();

  for (const row of rows) {
    const category = categoryOf(row);
    if (!category || effectiveTxnType(row, category) !== 'expense') continue;

    const bucketIndex = monthBuckets.findIndex((b) => row.txn_date >= b.startKey && row.txn_date <= b.endKey);
    if (bucketIndex === -1) continue;

    const entry = byCategory.get(row.category_id) ?? { name: category.name, monthTotals: new Map() };
    entry.monthTotals.set(bucketIndex, (entry.monthTotals.get(bucketIndex) ?? 0) + Number(row.amount));
    byCategory.set(row.category_id, entry);
  }

  return Array.from(byCategory.entries())
    .map(([categoryId, { name, monthTotals }]) => ({
      categoryId,
      categoryName: name,
      months: monthBuckets.map((b, i) => ({ month: b.label, amount: monthTotals.get(i) ?? 0 })),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

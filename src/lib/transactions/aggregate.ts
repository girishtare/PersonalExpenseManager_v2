import { effectiveTxnType, type TxnType } from './type';

export function categoryOf<C>(row: { categories: C[] | C | null }): C | null {
  const c = row.categories;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

/**
 * Sums rows by effective type (income/expense/transfer/investment) rather than raw
 * debit/credit direction - transfers (e.g. CC bill payments, own-account moves) and
 * investments are never counted as real income or expense. See effectiveTxnType.
 *
 * Generic over the embedded category shape so callers that don't need the category name
 * (e.g. the trend chart, which only selects categories(txn_type)) aren't forced to fetch it.
 */
export function sumByType<C extends { txn_type: TxnType }>(
  rows: { amount: number; txn_type_override: TxnType | null; categories: C[] | C | null }[],
  type: TxnType
): number {
  return rows.reduce((sum, row) => {
    const category = categoryOf(row);
    if (!category || effectiveTxnType(row, category) !== type) return sum;
    return sum + Number(row.amount);
  }, 0);
}

export function aggregateByCategory<C extends { name: string; txn_type: TxnType }>(
  rows: { amount: number; txn_type_override: TxnType | null; categories: C[] | C | null }[],
  type: TxnType
): { name: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = categoryOf(row);
    if (!category || effectiveTxnType(row, category) !== type) continue;
    totals.set(category.name, (totals.get(category.name) ?? 0) + Number(row.amount));
  }
  return Array.from(totals.entries()).map(([name, amount]) => ({ name, amount }));
}

/**
 * N/A when there's no income to divide by, or when income is dwarfed by expense (more than
 * 5x) - a partial-period guard so a mid-cycle view (bills already paid, salary not yet
 * credited) never renders an absurd rate like -6733%.
 */
export function computeSavingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null;
  if (expense > income * 5) return null;
  return ((income - expense) / income) * 100;
}

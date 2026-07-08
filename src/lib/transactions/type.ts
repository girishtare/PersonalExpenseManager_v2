export type TxnType = 'expense' | 'income' | 'transfer' | 'investment';

/**
 * The type a transaction actually counts as for aggregation purposes - a per-transaction
 * override (for one-off exceptions) takes precedence over its category's default. This is the
 * only place that resolves the two; every aggregate (dashboard KPIs, category breakdowns,
 * trend chart) must go through it rather than reading category_id/direction directly, or it
 * silently regresses to the old debit/credit-based double-counting.
 */
export function effectiveTxnType(
  txn: { txn_type_override: TxnType | null },
  category: { txn_type: TxnType }
): TxnType {
  return txn.txn_type_override ?? category.txn_type;
}

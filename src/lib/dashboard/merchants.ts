import { reduceDescription } from '../transactions/similar';
import type { MonthBucket } from './category-trend';

export interface MerchantTxn {
  description_raw: string;
  amount: number;
}

export interface MerchantDelta {
  key: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  /** Additional labeled comparison periods (e.g. 2/3 months ago) beyond `previous`, in the same
   * order they were passed in. */
  history: { label: string; amount: number }[];
}

export interface MerchantTrendTxn {
  description_raw: string;
  amount: number;
  txn_date: string;
}

export interface MerchantPeriod {
  label: string;
  rows: MerchantTxn[];
}

/** Groups one period's transactions by "core" merchant text (see reduceDescription), keeping
 * the first real description_raw seen as the display name - never the bare reduced key, which
 * is only meant as an internal grouping id. */
function groupByMerchant(rows: MerchantTxn[]): Map<string, { name: string; total: number }> {
  const totals = new Map<string, { name: string; total: number }>();
  for (const t of rows) {
    const key = reduceDescription(t.description_raw);
    if (key.length < 4) continue;
    const entry = totals.get(key) ?? { name: t.description_raw, total: 0 };
    entry.total += t.amount;
    totals.set(key, entry);
  }
  return totals;
}

/**
 * Groups transactions by their "core" merchant text (see reduceDescription) and computes each
 * merchant's current-vs-previous-period totals, sorted by the size of that change (not the
 * absolute spend) so the biggest movers surface first regardless of direction. `extraPeriods`
 * (e.g. 2/3 months ago) are purely informational - they don't affect sorting or `delta`, which
 * stay anchored to the immediately-previous period.
 */
export function computeTopMerchants(
  current: MerchantTxn[],
  previous: MerchantTxn[],
  extraPeriods: MerchantPeriod[] = [],
  limit = 10
): MerchantDelta[] {
  const currentTotals = groupByMerchant(current);
  const previousTotals = groupByMerchant(previous);
  const extraTotals = extraPeriods.map((p) => groupByMerchant(p.rows));

  const allKeys = new Set([...currentTotals.keys(), ...previousTotals.keys(), ...extraTotals.flatMap((t) => [...t.keys()])]);
  const rows: MerchantDelta[] = [];
  for (const key of allKeys) {
    const currentEntry = currentTotals.get(key);
    const previousEntry = previousTotals.get(key);
    const currentTotal = currentEntry?.total ?? 0;
    const previousTotal = previousEntry?.total ?? 0;
    const hasExtraActivity = extraTotals.some((t) => t.has(key));
    if (currentTotal === 0 && previousTotal === 0 && !hasExtraActivity) continue;
    rows.push({
      key,
      // A real raw description from whichever period has one - the bare key is only a
      // last-resort fallback that should never actually trigger in practice.
      name: currentEntry?.name ?? previousEntry?.name ?? extraTotals.find((t) => t.has(key))?.get(key)?.name ?? key,
      current: currentTotal,
      previous: previousTotal,
      delta: currentTotal - previousTotal,
      history: extraPeriods.map((p, i) => ({ label: p.label, amount: extraTotals[i].get(key)?.total ?? 0 })),
    });
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

/**
 * Attaches a per-month spend trend to each of the given merchants, for an inline sparkline -
 * `trendRows` is expected to already be expense-only (same filter computeTopMerchants' callers
 * apply before calling it) and to span (at least) the given month buckets. Pre-groups trendRows
 * into a single pass rather than re-filtering per merchant, since this runs against the same
 * up-to-12-month dataset the overall trend chart uses.
 */
export function attachMerchantTrend<T extends { key: string }>(
  merchants: T[],
  trendRows: MerchantTrendTxn[],
  monthBuckets: MonthBucket[]
): (T & { trend: { month: string; amount: number }[] })[] {
  const totals = new Map<string, number>(); // "<merchantKey>|<bucketIndex>" -> amount
  for (const row of trendRows) {
    const key = reduceDescription(row.description_raw);
    if (key.length < 4) continue;
    const bucketIndex = monthBuckets.findIndex((b) => row.txn_date >= b.startKey && row.txn_date <= b.endKey);
    if (bucketIndex === -1) continue;
    const mapKey = `${key}|${bucketIndex}`;
    totals.set(mapKey, (totals.get(mapKey) ?? 0) + row.amount);
  }

  return merchants.map((m) => ({
    ...m,
    trend: monthBuckets.map((b, i) => ({ month: b.label, amount: totals.get(`${m.key}|${i}`) ?? 0 })),
  }));
}

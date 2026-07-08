import { reduceDescription } from '../transactions/similar';

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
}

/**
 * Groups transactions by their "core" merchant text (see reduceDescription) and computes each
 * merchant's current-vs-previous-period totals, sorted by the size of the change (not the
 * absolute spend) so the biggest movers surface first regardless of direction.
 */
export function computeTopMerchants(current: MerchantTxn[], previous: MerchantTxn[], limit = 10): MerchantDelta[] {
  const currentTotals = new Map<string, { name: string; total: number }>();
  for (const t of current) {
    const key = reduceDescription(t.description_raw);
    if (key.length < 4) continue;
    const entry = currentTotals.get(key) ?? { name: t.description_raw, total: 0 };
    entry.total += t.amount;
    currentTotals.set(key, entry);
  }

  const previousTotals = new Map<string, number>();
  for (const t of previous) {
    const key = reduceDescription(t.description_raw);
    if (key.length < 4) continue;
    previousTotals.set(key, (previousTotals.get(key) ?? 0) + t.amount);
  }

  const allKeys = new Set([...currentTotals.keys(), ...previousTotals.keys()]);
  const rows: MerchantDelta[] = [];
  for (const key of allKeys) {
    const currentEntry = currentTotals.get(key);
    const currentTotal = currentEntry?.total ?? 0;
    const previousTotal = previousTotals.get(key) ?? 0;
    if (currentTotal === 0 && previousTotal === 0) continue;
    rows.push({
      key,
      name: currentEntry?.name ?? key,
      current: currentTotal,
      previous: previousTotal,
      delta: currentTotal - previousTotal,
    });
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

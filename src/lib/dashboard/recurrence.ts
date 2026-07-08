import { reduceDescription } from '../transactions/similar';
import { parseDateKey, shiftByMonths, toDateKey } from './period';

export interface RecurrenceTxn {
  txn_date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description_raw: string;
}

export interface UpcomingDebit {
  descriptionKey: string;
  sampleDescription: string;
  expectedAmount: number;
  expectedDate: string;
  occurrences: number;
  lastAmount: number;
  lastDate: string;
}

const AMOUNT_TOLERANCE = 0.05;
const MIN_OCCURRENCES = 3;
const MIN_GAP_DAYS = 20;
const MAX_GAP_DAYS = 40;
/** If the predicted next occurrence is already this many days in the past, treat the pattern as stopped rather than upcoming. */
const STALE_AFTER_DAYS = 10;

/**
 * Detects recurring debits (EMIs, SIPs, subscriptions, ...) purely from the transaction data
 * pattern - same "core" merchant/counterparty text (see reduceDescription), amount consistent
 * within +/-5%, and roughly monthly spacing across at least 3 occurrences in 3 distinct
 * calendar months. Deliberately not filtered by category/txn_type: an EMI is expense-type and a
 * SIP is investment-type, so filtering to one would miss the other - "debit direction" is the
 * only filter, matching the card's name.
 */
export function detectRecurringDebits(transactions: RecurrenceTxn[], asOf: Date = new Date()): UpcomingDebit[] {
  const groups = new Map<string, RecurrenceTxn[]>();
  for (const t of transactions) {
    if (t.direction !== 'debit') continue;
    const key = reduceDescription(t.description_raw);
    if (key.length < 4) continue; // too generic to reliably group (same guard as the similar-transactions feature)
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const results: UpcomingDebit[] = [];

  for (const [key, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.txn_date.localeCompare(b.txn_date));

    const monthsCovered = new Set(sorted.map((t) => t.txn_date.slice(0, 7)));
    if (monthsCovered.size < MIN_OCCURRENCES) continue;

    const amounts = sorted.map((t) => t.amount);
    const meanAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const amountsConsistent = amounts.every((a) => Math.abs(a - meanAmount) <= meanAmount * AMOUNT_TOLERANCE);
    if (!amountsConsistent) continue;

    const gapsInDays: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDateKey(sorted[i - 1].txn_date);
      const curr = parseDateKey(sorted[i].txn_date);
      gapsInDays.push((curr.getTime() - prev.getTime()) / 86_400_000);
    }
    const monthlyLike = gapsInDays.every((g) => g >= MIN_GAP_DAYS && g <= MAX_GAP_DAYS);
    if (!monthlyLike) continue;

    const last = sorted[sorted.length - 1];
    const expectedDate = shiftByMonths(parseDateKey(last.txn_date), 1);
    const daysPastExpected = (asOf.getTime() - expectedDate.getTime()) / 86_400_000;
    if (daysPastExpected > STALE_AFTER_DAYS) continue;

    results.push({
      descriptionKey: key,
      sampleDescription: last.description_raw,
      expectedAmount: Math.round(meanAmount * 100) / 100,
      expectedDate: toDateKey(expectedDate),
      occurrences: sorted.length,
      lastAmount: last.amount,
      lastDate: last.txn_date,
    });
  }

  return results.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
}

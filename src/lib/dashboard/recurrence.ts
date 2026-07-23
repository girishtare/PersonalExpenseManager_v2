import { reduceDescription } from '../transactions/similar';
import { parseDateKey, shiftByMonths, toDateKey } from './period';

export interface RecurrenceTxn {
  txn_date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description_raw: string;
  /** Category name, when known - "Bills & Utilities" gets the amount-variance rule relaxed
   * below, since a genuinely recurring electricity/mobile bill still varies month to month by
   * usage, unlike an EMI/SIP/subscription where a varying amount means it ISN'T the same
   * recurring payment. */
  categoryName?: string | null;
}

export interface UpcomingDebit {
  descriptionKey: string;
  sampleDescription: string;
  expectedAmount: number;
  expectedDate: string;
  occurrences: number;
  lastAmount: number;
  lastDate: string;
  /** True when expectedAmount is an average over varying real amounts (bills & utilities)
   * rather than a consistent fixed amount (EMI, subscription, ...). */
  isEstimate: boolean;
}

const AMOUNT_TOLERANCE = 0.05;
const MIN_OCCURRENCES = 3;
const MIN_GAP_DAYS = 20;
const MAX_GAP_DAYS = 40;
/** A single markedly wider gap (one skipped/delayed cycle) is still consistent with an otherwise
 * monthly pattern - e.g. a household-expenses transfer that's ~30 days every month except one
 * 62-day stretch. More than one such gap looks like a genuinely different (or non-monthly)
 * cadence rather than an occasional skip, so only one is tolerated. */
const SKIPPED_CYCLE_MAX_GAP_DAYS = MAX_GAP_DAYS * 2;
const MAX_WIDE_GAPS = 1;
/** If the predicted next occurrence is already this many days in the past, treat the pattern as stopped rather than upcoming. */
const STALE_AFTER_DAYS = 10;
const VARIABLE_AMOUNT_CATEGORY = 'Bills & Utilities';

/**
 * Detects recurring debits (EMIs, SIPs, subscriptions, bills, ...) purely from the transaction
 * data pattern - same "core" merchant/counterparty text (see reduceDescription) and roughly
 * monthly spacing across at least 3 occurrences in 3 distinct calendar months. Deliberately not
 * filtered by category/txn_type generally: an EMI is expense-type and a SIP is investment-type,
 * so filtering to one would miss the other - "debit direction" is the only filter, matching the
 * card's name. Amount consistency (+/-5%) is required EXCEPT for "Bills & Utilities", where the
 * average is used as the expected amount instead, since usage-based bills are still recurring
 * despite varying.
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

    const lastTxn = sorted[sorted.length - 1];

    const amounts = sorted.map((t) => t.amount);
    const meanAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    // The most recent occurrence's category is the current, presumably-accurate one to check -
    // a group is always the same counterparty (same reduceDescription key), so its category
    // shouldn't normally shift, but if it ever did, "current" is the more useful signal anyway.
    const isVariableAmount = lastTxn.categoryName === VARIABLE_AMOUNT_CATEGORY;
    const amountsConsistent =
      isVariableAmount || amounts.every((a) => Math.abs(a - meanAmount) <= meanAmount * AMOUNT_TOLERANCE);
    if (!amountsConsistent) continue;

    const gapsInDays: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDateKey(sorted[i - 1].txn_date);
      const curr = parseDateKey(sorted[i].txn_date);
      gapsInDays.push((curr.getTime() - prev.getTime()) / 86_400_000);
    }
    const allGapsPlausible = gapsInDays.every((g) => g >= MIN_GAP_DAYS && g <= SKIPPED_CYCLE_MAX_GAP_DAYS);
    const wideGapCount = gapsInDays.filter((g) => g > MAX_GAP_DAYS).length;
    const monthlyLike = allGapsPlausible && wideGapCount <= MAX_WIDE_GAPS;
    if (!monthlyLike) continue;

    const expectedDate = shiftByMonths(parseDateKey(lastTxn.txn_date), 1);
    const daysPastExpected = (asOf.getTime() - expectedDate.getTime()) / 86_400_000;
    if (daysPastExpected > STALE_AFTER_DAYS) continue;

    results.push({
      descriptionKey: key,
      sampleDescription: lastTxn.description_raw,
      expectedAmount: Math.round(meanAmount * 100) / 100,
      expectedDate: toDateKey(expectedDate),
      occurrences: sorted.length,
      lastAmount: lastTxn.amount,
      lastDate: lastTxn.txn_date,
      isEstimate: isVariableAmount,
    });
  }

  return results.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
}

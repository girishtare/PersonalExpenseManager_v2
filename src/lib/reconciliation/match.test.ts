import { describe, expect, it } from 'vitest';
import {
  findStatementTotalMismatches,
  reconcileCcBillPayments,
  type BillPayment,
  type CardStatement,
  type StatementActivity,
} from './match';

function payment(id: string, txn_date: string, amount: number): BillPayment {
  return { id, txn_date, amount, description_raw: 'IB BILLPAY DR-HDFCMW-XXXXXX' };
}

function statement(
  id: string,
  periodEnd: string | null,
  totalAmountDue: number | null,
  periodStart: string | null = null
): CardStatement {
  return { id, file_name: `${id}.xls`, statement_period_start: periodStart, statement_period_end: periodEnd, total_amount_due: totalAmountDue };
}

describe('reconcileCcBillPayments - matching tolerance', () => {
  it('matches when the amounts are exactly equal', () => {
    const result = reconcileCcBillPayments([payment('p1', '2026-02-05', 201756)], [statement('s1', '2026-01-16', 201756)]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].amountDiff).toBe(0);
  });

  it('matches at exactly Rs.1 difference (boundary is inclusive)', () => {
    const result = reconcileCcBillPayments([payment('p1', '2026-02-05', 1001)], [statement('s1', '2026-01-16', 1000)]);
    expect(result.matched).toHaveLength(1);
  });

  it('does not match at Rs.1.01 difference', () => {
    const result = reconcileCcBillPayments([payment('p1', '2026-02-05', 1001.01)], [statement('s1', '2026-01-16', 1000)]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedPayments).toHaveLength(1);
    expect(result.unmatchedStatements).toHaveLength(1);
  });

  it('excludes a statement whose period ends on or after the payment date', () => {
    // Same-day period end as the payment date should NOT match - you pay after the bill closes, not on the same day.
    const sameDay = reconcileCcBillPayments([payment('p1', '2026-01-16', 500)], [statement('s1', '2026-01-16', 500)]);
    expect(sameDay.matched).toHaveLength(0);

    const after = reconcileCcBillPayments([payment('p1', '2026-01-10', 500)], [statement('s1', '2026-01-16', 500)]);
    expect(after.matched).toHaveLength(0);

    const before = reconcileCcBillPayments([payment('p1', '2026-01-17', 500)], [statement('s1', '2026-01-16', 500)]);
    expect(before.matched).toHaveLength(1);
  });

  it('picks the closest amount when multiple statements are within tolerance', () => {
    const result = reconcileCcBillPayments(
      [payment('p1', '2026-02-05', 1000)],
      [statement('near', '2026-01-16', 999.5), statement('far', '2026-01-10', 1000.9)]
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].statement.id).toBe('near');
  });

  it('does not let two payments claim the same statement', () => {
    const result = reconcileCcBillPayments(
      [payment('p1', '2026-02-05', 1000), payment('p2', '2026-03-05', 1000)],
      [statement('s1', '2026-01-16', 1000)]
    );
    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedPayments).toHaveLength(1);
  });

  it('separates statements missing total_amount_due or period_end as unverifiable, never unmatched', () => {
    const result = reconcileCcBillPayments(
      [payment('p1', '2026-02-05', 500)],
      [statement('no-total', '2026-01-16', null), statement('no-period', null, 500)]
    );
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedStatements).toHaveLength(0);
    expect(result.unverifiableStatements).toHaveLength(2);
  });
});

function activity(
  id: string,
  totalAmountDue: number | null,
  openingBalance: number | null,
  sumOfTransactions: number
): StatementActivity {
  return { id, file_name: `${id}.xls`, total_amount_due: totalAmountDue, opening_balance: openingBalance, sumOfTransactions };
}

describe('findStatementTotalMismatches - unmatched/discrepancy detection', () => {
  it('does not flag when opening balance + transactions matches total due within tolerance', () => {
    // 134738.88 (opening) + 67016.83 (transactions) = 201755.71, vs total due 201756.00 -> diff 0.29
    const result = findStatementTotalMismatches([activity('s1', 201756, 134738.88, 67016.83)]);
    expect(result.flagged).toHaveLength(0);
  });

  it('flags when the difference exceeds tolerance', () => {
    const result = findStatementTotalMismatches([activity('s1', 201756, 134738.88, 60000)]);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].expected).toBeCloseTo(67017.12, 2);
    expect(result.flagged[0].diff).toBeCloseTo(60000 - 67017.12, 2);
  });

  it('treats missing opening_balance or total_amount_due as not verifiable, not flagged', () => {
    const result = findStatementTotalMismatches([activity('no-opening', 201756, null, 999999), activity('no-total', null, 100, 999999)]);
    expect(result.flagged).toHaveLength(0);
    expect(result.notVerifiable).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { computeSavingsRate, sumByType } from './aggregate';
import type { TxnType } from './type';

interface TestRow {
  amount: number;
  txn_type_override: TxnType | null;
  categories: { name: string; txn_type: TxnType };
}

function txn(amount: number, categoryTxnType: TxnType, override: TxnType | null = null): TestRow {
  return {
    amount,
    txn_type_override: override,
    categories: { name: 'test category', txn_type: categoryTxnType },
  };
}

describe('sumByType - transfer exclusion', () => {
  const rows: TestRow[] = [
    txn(50000, 'income'), // Salary
    txn(2000, 'income'), // Interest
    txn(12000, 'expense'), // Groceries
    txn(3000, 'expense'), // Dining
    txn(40000, 'transfer'), // CC Payment (credit side, would otherwise look like income)
    txn(40000, 'transfer'), // CC Bill Payment (debit side, would otherwise look like expense)
    txn(5000, 'investment'), // Mutual Funds
  ];

  it('income total excludes transfer rows entirely', () => {
    expect(sumByType(rows, 'income')).toBe(52000);
  });

  it('expense total excludes transfer rows entirely', () => {
    expect(sumByType(rows, 'expense')).toBe(15000);
  });

  it('transfer rows are still tracked under their own bucket, not silently dropped', () => {
    expect(sumByType(rows, 'transfer')).toBe(80000);
  });

  it('investment rows are excluded from both income and expense', () => {
    expect(sumByType(rows, 'investment')).toBe(5000);
    // 52000 + 15000 + 80000 + 5000 accounts for every row - nothing double-counted either.
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    expect(sumByType(rows, 'income') + sumByType(rows, 'expense') + sumByType(rows, 'transfer') + sumByType(rows, 'investment')).toBe(
      total
    );
  });

  it('a per-transaction override reclassifies a row out of its category default', () => {
    const withOverride = [
      txn(500, 'expense', 'transfer'), // e.g. a one-off self-transfer miscategorised as a generic expense category
    ];
    expect(sumByType(withOverride, 'expense')).toBe(0);
    expect(sumByType(withOverride, 'transfer')).toBe(500);
  });
});

describe('computeSavingsRate - N/A guards', () => {
  it('returns null when income is zero', () => {
    expect(computeSavingsRate(0, 500)).toBeNull();
  });

  it('returns null when income is negative (defensive)', () => {
    expect(computeSavingsRate(-100, 50)).toBeNull();
  });

  it('returns null when expense exceeds income by more than 5x', () => {
    // income=100, expense=501 -> ratio 5.01x
    expect(computeSavingsRate(100, 501)).toBeNull();
  });

  it('does not guard at exactly 5x - only strictly greater', () => {
    // income=100, expense=500 -> exactly 5x, still a real (very negative) number
    expect(computeSavingsRate(100, 500)).toBe(-400);
  });

  it('computes a normal positive savings rate', () => {
    expect(computeSavingsRate(1000, 600)).toBeCloseTo(40, 5);
  });

  it('computes a normal negative savings rate within the 5x guard', () => {
    expect(computeSavingsRate(1000, 1200)).toBeCloseTo(-20, 5);
  });
});

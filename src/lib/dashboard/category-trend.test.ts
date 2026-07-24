import { describe, expect, it } from 'vitest';
import { computeCategoryMonthlyTrend, type CategoryTrendTxn, type MonthBucket } from './category-trend';

const BUCKETS: MonthBucket[] = [
  { startKey: '2026-05-01', endKey: '2026-05-31', label: 'May 2026' },
  { startKey: '2026-06-01', endKey: '2026-06-30', label: 'Jun 2026' },
  { startKey: '2026-07-01', endKey: '2026-07-31', label: 'Jul 2026' },
];

function txn(
  txn_date: string,
  amount: number,
  categoryId: string,
  categoryName: string,
  txn_type: 'expense' | 'income' | 'transfer' | 'investment' = 'expense',
  txn_type_override: 'expense' | 'income' | 'transfer' | 'investment' | null = null,
  description_raw = 'SOME MERCHANT'
): CategoryTrendTxn {
  return { txn_date, amount, txn_type_override, category_id: categoryId, description_raw, categories: { name: categoryName, txn_type } };
}

describe('computeCategoryMonthlyTrend', () => {
  it('buckets one category across months, zero-filling months with no spend', () => {
    const result = computeCategoryMonthlyTrend(
      [
        txn('2026-05-10', 500, 'cat-groceries', 'Groceries', 'expense', null, 'STAR BAZAAR'),
        txn('2026-07-15', 700, 'cat-groceries', 'Groceries', 'expense', null, 'BIG BASKET'),
      ],
      BUCKETS
    );
    expect(result).toEqual([
      {
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        months: [
          {
            month: 'May 2026',
            amount: 500,
            transactions: [{ description: 'STAR BAZAAR', merchantKey: 'star bazaar', amount: 500, date: '2026-05-10' }],
          },
          { month: 'Jun 2026', amount: 0, transactions: [] },
          {
            month: 'Jul 2026',
            amount: 700,
            transactions: [{ description: 'BIG BASKET', merchantKey: 'big basket', amount: 700, date: '2026-07-15' }],
          },
        ],
      },
    ]);
  });

  it('lists a month bucket its individual transactions, largest first', () => {
    const result = computeCategoryMonthlyTrend(
      [
        txn('2026-06-01', 200, 'cat-dining', 'Dining', 'expense', null, 'SMALL SNACK'),
        txn('2026-06-20', 900, 'cat-dining', 'Dining', 'expense', null, 'BIG DINNER'),
      ],
      BUCKETS
    );
    expect(result[0].months[1].transactions.map((t) => t.description)).toEqual(['BIG DINNER', 'SMALL SNACK']);
  });

  it('sums multiple transactions within the same month', () => {
    const result = computeCategoryMonthlyTrend(
      [txn('2026-06-01', 200, 'cat-dining', 'Dining'), txn('2026-06-20', 300, 'cat-dining', 'Dining')],
      BUCKETS
    );
    expect(result[0].months[1].amount).toBe(500);
  });

  it('keeps separate categories separate', () => {
    const result = computeCategoryMonthlyTrend(
      [txn('2026-06-01', 200, 'cat-dining', 'Dining'), txn('2026-06-01', 900, 'cat-rent', 'Rent')],
      BUCKETS
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.categoryName).sort()).toEqual(['Dining', 'Rent']);
  });

  it('excludes income, transfer, and investment rows', () => {
    const result = computeCategoryMonthlyTrend(
      [
        txn('2026-06-01', 50000, 'cat-salary', 'Salary', 'income'),
        txn('2026-06-01', 1000, 'cat-transfer', 'Transfers Out (Own Accounts)', 'transfer'),
        txn('2026-06-01', 2000, 'cat-mf', 'Mutual Funds', 'investment'),
      ],
      BUCKETS
    );
    expect(result).toHaveLength(0);
  });

  it('honors a per-transaction txn_type_override', () => {
    // Category default is 'transfer', but this specific row was overridden to 'expense'.
    const result = computeCategoryMonthlyTrend(
      [txn('2026-06-01', 1500, 'cat-transfer', 'Transfers Out (Own Accounts)', 'transfer', 'expense')],
      BUCKETS
    );
    expect(result).toHaveLength(1);
    expect(result[0].months[1].amount).toBe(1500);
  });

  it('ignores rows outside every bucket', () => {
    const result = computeCategoryMonthlyTrend([txn('2025-01-01', 500, 'cat-groceries', 'Groceries')], BUCKETS);
    expect(result).toHaveLength(0);
  });

  it('returns categories sorted by name', () => {
    const result = computeCategoryMonthlyTrend(
      [txn('2026-06-01', 100, 'cat-z', 'Zoo Fees'), txn('2026-06-01', 100, 'cat-a', 'Auto Repair')],
      BUCKETS
    );
    expect(result.map((r) => r.categoryName)).toEqual(['Auto Repair', 'Zoo Fees']);
  });
});

import { describe, expect, it } from 'vitest';
import { computeInsights, type InsightTxn } from './insights';

function txn(
  amount: number,
  categoryName: string,
  description_raw = 'SOME MERCHANT',
  txn_date = '2026-07-10',
  txn_type: 'expense' | 'income' | 'transfer' | 'investment' = 'expense'
): InsightTxn {
  return { amount, txn_date, txn_type_override: null, category_id: categoryName, description_raw, categories: { name: categoryName, txn_type } };
}

describe('computeInsights', () => {
  it('returns nothing when there is no data at all, current or historical', () => {
    expect(computeInsights([], [[], [], []], new Map(), null)).toEqual([]);
  });

  it('flags spending meaningfully above the 3-month average as negative', () => {
    const current = [txn(20000, 'Shopping')];
    const history = [[txn(10000, 'Shopping')], [txn(10000, 'Shopping')], [txn(10000, 'Shopping')]];
    const result = computeInsights(current, history, new Map(), null);
    const expenseInsight = result.find((i) => i.id === 'expense-vs-average');
    expect(expenseInsight?.tone).toBe('negative');
    expect(expenseInsight?.text).toContain('100% above');
  });

  it('flags spending meaningfully below the 3-month average as positive', () => {
    const current = [txn(5000, 'Shopping')];
    const history = [[txn(10000, 'Shopping')], [txn(10000, 'Shopping')], [txn(10000, 'Shopping')]];
    const result = computeInsights(current, history, new Map(), null);
    const expenseInsight = result.find((i) => i.id === 'expense-vs-average');
    expect(expenseInsight?.tone).toBe('positive');
    expect(expenseInsight?.text).toContain('50% below');
  });

  it('treats a small change (within 5%) as flat, not a move', () => {
    const current = [txn(10200, 'Shopping')];
    const history = [[txn(10000, 'Shopping')], [txn(10000, 'Shopping')], [txn(10000, 'Shopping')]];
    const result = computeInsights(current, history, new Map(), null);
    expect(result.find((i) => i.id === 'expense-vs-average')?.tone).toBe('neutral');
  });

  it('treats higher income as positive and lower income as negative', () => {
    const current = [txn(50000, 'Salary', 'PAY', '2026-07-01', 'income')];
    const history = [
      [txn(40000, 'Salary', 'PAY', '2026-06-01', 'income')],
      [txn(40000, 'Salary', 'PAY', '2026-05-01', 'income')],
      [txn(40000, 'Salary', 'PAY', '2026-04-01', 'income')],
    ];
    const result = computeInsights(current, history, new Map(), null);
    expect(result.find((i) => i.id === 'income-vs-average')?.tone).toBe('positive');
  });

  it('calls out the category responsible for the biggest move', () => {
    const current = [txn(15000, 'Dining'), txn(2000, 'Groceries')];
    const history = [
      [txn(2000, 'Dining'), txn(2000, 'Groceries')],
      [txn(2000, 'Dining'), txn(2000, 'Groceries')],
      [txn(2000, 'Dining'), txn(2000, 'Groceries')],
    ];
    const result = computeInsights(current, history, new Map(), null);
    const driver = result.find((i) => i.id === 'category-driver');
    expect(driver?.text).toContain('Dining');
    expect(driver?.tone).toBe('negative');
  });

  it('does not call out a category move that is too small to matter', () => {
    const current = [txn(2100, 'Dining')];
    const history = [[txn(2000, 'Dining')], [txn(2000, 'Dining')], [txn(2000, 'Dining')]];
    const result = computeInsights(current, history, new Map(), null);
    expect(result.find((i) => i.id === 'category-driver')).toBeUndefined();
  });

  it('names the single largest expense, preferring a merchant alias when one is set', () => {
    const current = [txn(500, 'Dining', 'SMALL SNACK'), txn(9000, 'Shopping', 'CARD ZODIAC')];
    const aliases = new Map([['card zodiac', 'New Laptop']]);
    const result = computeInsights(current, [[], [], []], aliases, null);
    const biggest = result.find((i) => i.id === 'biggest-expense');
    expect(biggest?.text).toContain('New Laptop');
    expect(biggest?.text).not.toContain('SMALL SNACK');
  });

  it('excludes income/transfer/investment rows from the biggest-expense search', () => {
    const current = [
      txn(100000, 'Salary', 'PAY', '2026-07-01', 'income'),
      txn(500, 'Dining', 'SMALL SNACK'),
    ];
    const result = computeInsights(current, [[], [], []], new Map(), null);
    expect(result.find((i) => i.id === 'biggest-expense')?.text).toContain('SMALL SNACK');
  });

  it('adds a pace projection only when given a mid-month pace end date', () => {
    const current = [txn(10000, 'Shopping', 'SHOP', '2026-07-10')];
    const withoutPace = computeInsights(current, [[], [], []], new Map(), null);
    expect(withoutPace.find((i) => i.id === 'pace-projection')).toBeUndefined();

    const withPace = computeInsights(current, [[], [], []], new Map(), { end: new Date(2026, 6, 10) });
    const projection = withPace.find((i) => i.id === 'pace-projection');
    expect(projection).toBeDefined();
    expect(projection?.text).toMatch(/₹31,000/); // 10000 * 31 days / 10 days elapsed
  });

  it('skips the pace projection when the period is essentially already complete', () => {
    const current = [txn(10000, 'Shopping', 'SHOP', '2026-07-31')];
    const result = computeInsights(current, [[], [], []], new Map(), { end: new Date(2026, 6, 31) });
    expect(result.find((i) => i.id === 'pace-projection')).toBeUndefined();
  });
});

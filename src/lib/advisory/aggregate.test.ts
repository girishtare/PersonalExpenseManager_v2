import { describe, expect, it } from 'vitest';
import { computeAdvisoryInputs, type AdvisoryTxn } from './aggregate';

function txn(
  amount: number,
  categoryName: string,
  txn_type: 'expense' | 'income' | 'transfer' | 'investment',
  txn_type_override: 'expense' | 'income' | 'transfer' | 'investment' | null = null
): AdvisoryTxn {
  return { amount, txn_type_override, categories: { name: categoryName, txn_type } };
}

describe('computeAdvisoryInputs', () => {
  it('sums income, expense, and investment independently', () => {
    const result = computeAdvisoryInputs([
      txn(100000, 'Salary', 'income'),
      txn(60000, 'Groceries', 'expense'),
      txn(10000, 'Mutual Funds', 'investment'),
    ]);
    expect(result.totalIncome).toBe(100000);
    expect(result.totalExpense).toBe(60000);
    expect(result.totalInvestment).toBe(10000);
  });

  it('computes EMI and investment as a % of income', () => {
    const result = computeAdvisoryInputs([
      txn(100000, 'Salary', 'income'),
      txn(20000, 'EMI & Loan Payments', 'expense'),
      txn(10000, 'Mutual Funds', 'investment'),
    ]);
    expect(result.emiExpense).toBe(20000);
    expect(result.emiRatioPct).toBeCloseTo(20, 5);
    expect(result.investmentRatePct).toBeCloseTo(10, 5);
  });

  it('returns null ratios when there is no income to divide by', () => {
    const result = computeAdvisoryInputs([txn(5000, 'Groceries', 'expense')]);
    expect(result.emiRatioPct).toBeNull();
    expect(result.investmentRatePct).toBeNull();
  });

  it('floors surplusNotInvested at 0 rather than going negative', () => {
    const result = computeAdvisoryInputs([
      txn(50000, 'Salary', 'income'),
      txn(60000, 'Rent', 'expense'),
      txn(5000, 'Mutual Funds', 'investment'),
    ]);
    expect(result.surplusNotInvested).toBe(0);
  });

  it('computes the surplus not yet invested', () => {
    const result = computeAdvisoryInputs([
      txn(100000, 'Salary', 'income'),
      txn(60000, 'Rent', 'expense'),
      txn(10000, 'Mutual Funds', 'investment'),
    ]);
    expect(result.surplusNotInvested).toBe(30000);
  });

  it('ranks top expense categories largest first, capped at 8', () => {
    const rows: AdvisoryTxn[] = Array.from({ length: 10 }, (_, i) => txn((i + 1) * 1000, `Category ${i}`, 'expense'));
    const result = computeAdvisoryInputs(rows);
    expect(result.topExpenseCategories).toHaveLength(8);
    expect(result.topExpenseCategories[0].name).toBe('Category 9');
    expect(result.topExpenseCategories[0].amount).toBe(10000);
  });

  it('honors a per-transaction txn_type_override when finding EMI spend', () => {
    // Category default is 'transfer', but this row was overridden to 'expense'.
    const result = computeAdvisoryInputs([txn(15000, 'EMI & Loan Payments', 'transfer', 'expense')]);
    expect(result.emiExpense).toBe(15000);
  });

  it('sorts the investment breakdown largest first', () => {
    const result = computeAdvisoryInputs([
      txn(5000, 'Emergency Fund', 'investment'),
      txn(20000, 'Mutual Funds', 'investment'),
    ]);
    expect(result.investmentBreakdown.map((c) => c.name)).toEqual(['Mutual Funds', 'Emergency Fund']);
  });
});

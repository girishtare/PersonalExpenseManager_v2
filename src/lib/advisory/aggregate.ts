import { aggregateByCategory, sumByType } from '../transactions/aggregate';
import type { TxnType } from '../transactions/type';

export interface AdvisoryTxn {
  amount: number;
  txn_type_override: TxnType | null;
  categories: { name: string; txn_type: TxnType }[] | { name: string; txn_type: TxnType } | null;
}

export interface AdvisoryInputs {
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  emiExpense: number;
  /** EMI as a % of income - null when there's no income to divide by. */
  emiRatioPct: number | null;
  /** Investment as a % of income - null when there's no income to divide by. */
  investmentRatePct: number | null;
  /** income - expense - investment, floored at 0 - the surplus that isn't already being
   * deliberately invested (still sitting in a bank account, or otherwise unaccounted for). */
  surplusNotInvested: number;
  topExpenseCategories: { name: string; amount: number }[];
  investmentBreakdown: { name: string; amount: number }[];
}

const EMI_CATEGORY_NAME = 'EMI & Loan Payments';
const TOP_CATEGORY_COUNT = 8;

/**
 * Summarizes 12 months of transactions into the handful of numbers a financial-advisory prompt
 * needs: total income/expense/investment, EMI burden as a % of income, how much of the income-
 * minus-expense surplus isn't already being invested, and the biggest expense/investment
 * categories. Pure and testable - the actual LLM call lives in the route handler that uses this.
 */
export function computeAdvisoryInputs(rows: AdvisoryTxn[]): AdvisoryInputs {
  const totalIncome = sumByType(rows, 'income');
  const totalExpense = sumByType(rows, 'expense');
  const totalInvestment = sumByType(rows, 'investment');

  const expenseByCategory = aggregateByCategory(rows, 'expense').sort((a, b) => b.amount - a.amount);
  const investmentBreakdown = aggregateByCategory(rows, 'investment').sort((a, b) => b.amount - a.amount);

  const emiExpense = expenseByCategory.find((c) => c.name === EMI_CATEGORY_NAME)?.amount ?? 0;

  return {
    totalIncome,
    totalExpense,
    totalInvestment,
    emiExpense,
    emiRatioPct: totalIncome > 0 ? (emiExpense / totalIncome) * 100 : null,
    investmentRatePct: totalIncome > 0 ? (totalInvestment / totalIncome) * 100 : null,
    surplusNotInvested: Math.max(0, totalIncome - totalExpense - totalInvestment),
    topExpenseCategories: expenseByCategory.slice(0, TOP_CATEGORY_COUNT),
    investmentBreakdown,
  };
}

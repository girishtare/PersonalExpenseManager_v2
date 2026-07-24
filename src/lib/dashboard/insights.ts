import { aggregateByCategory, categoryOf, sumByType } from '../transactions/aggregate';
import { effectiveTxnType, type TxnType } from '../transactions/type';
import { reduceDescription } from '../transactions/similar';
import { projectMonthEnd } from './period';

export interface InsightTxn {
  amount: number;
  txn_date: string;
  txn_type_override: TxnType | null;
  category_id: string;
  description_raw: string;
  categories: { name: string; txn_type: TxnType }[] | { name: string; txn_type: TxnType } | null;
}

export type InsightTone = 'positive' | 'negative' | 'neutral';

export interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const formatDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** "12% above" / "8% below" / "roughly in line with" - flat inside +/-5%. */
function compareToAverage(current: number, avg: number): string {
  if (avg <= 0) return 'with no prior 3-month baseline to compare yet';
  const pct = ((current - avg) / avg) * 100;
  if (Math.abs(pct) < 5) return `roughly in line with your 3-month average of ${formatCurrency(avg)}`;
  return `${Math.abs(pct).toFixed(0)}% ${pct > 0 ? 'above' : 'below'} your 3-month average of ${formatCurrency(avg)}`;
}

// A category move has to clear both an absolute and a relative bar to be worth calling out -
// otherwise small, currently-negligible categories dominate just because their % change is huge.
const CATEGORY_MOVE_MIN_ABS = 1000;
const CATEGORY_MOVE_MIN_REL = 0.2;

/**
 * Builds a short, professional-toned summary of the current period against a 3-month baseline
 * (the same "same days" comparison periods used elsewhere on the dashboard, e.g. Top merchants) -
 * spend/income vs average, what's driving a change, the single largest expense, and (mid-month
 * only) a pace projection. Deliberately rule-based rather than free-form text generation, so it's
 * fast, deterministic, and testable like the rest of the dashboard's computations.
 */
export function computeInsights(
  current: InsightTxn[],
  history: InsightTxn[][],
  merchantAliasByKey: Map<string, string>,
  pace: { end: Date } | null
): Insight[] {
  const currentExpense = sumByType(current, 'expense');
  const currentIncome = sumByType(current, 'income');
  const avgExpense = mean(history.map((h) => sumByType(h, 'expense')));
  const avgIncome = mean(history.map((h) => sumByType(h, 'income')));

  if (currentExpense === 0 && currentIncome === 0 && avgExpense === 0 && avgIncome === 0) return [];

  const insights: Insight[] = [];

  if (currentExpense > 0 || avgExpense > 0) {
    const pct = avgExpense > 0 ? ((currentExpense - avgExpense) / avgExpense) * 100 : 0;
    insights.push({
      id: 'expense-vs-average',
      text: `Spending so far this period is ${formatCurrency(currentExpense)}, ${compareToAverage(currentExpense, avgExpense)}.`,
      tone: avgExpense > 0 ? (pct > 5 ? 'negative' : pct < -5 ? 'positive' : 'neutral') : 'neutral',
    });
  }

  // Category most responsible for the change - only worth naming if it clears a real bar.
  const currentByCategory = new Map(aggregateByCategory(current, 'expense').map((c) => [c.name, c.amount]));
  const historyByCategory = history.map((h) => new Map(aggregateByCategory(h, 'expense').map((c) => [c.name, c.amount])));
  const allCategoryNames = new Set([...currentByCategory.keys(), ...historyByCategory.flatMap((m) => [...m.keys()])]);

  let biggestMove: { name: string; current: number; avg: number; delta: number } | null = null;
  for (const name of allCategoryNames) {
    const curAmount = currentByCategory.get(name) ?? 0;
    const avgAmount = mean(historyByCategory.map((m) => m.get(name) ?? 0));
    const delta = curAmount - avgAmount;
    if (!biggestMove || Math.abs(delta) > Math.abs(biggestMove.delta)) {
      biggestMove = { name, current: curAmount, avg: avgAmount, delta };
    }
  }
  if (
    biggestMove &&
    Math.abs(biggestMove.delta) >= CATEGORY_MOVE_MIN_ABS &&
    (biggestMove.avg === 0 || Math.abs(biggestMove.delta) / biggestMove.avg >= CATEGORY_MOVE_MIN_REL)
  ) {
    const direction = biggestMove.delta > 0 ? 'higher' : 'lower';
    insights.push({
      id: 'category-driver',
      text: `${biggestMove.name} is the biggest mover: ${formatCurrency(biggestMove.current)} vs a typical ${formatCurrency(biggestMove.avg)} (${direction}).`,
      tone: biggestMove.delta > 0 ? 'negative' : 'positive',
    });
  }

  if (currentIncome > 0 || avgIncome > 0) {
    const pct = avgIncome > 0 ? ((currentIncome - avgIncome) / avgIncome) * 100 : 0;
    insights.push({
      id: 'income-vs-average',
      text: `Income so far this period is ${formatCurrency(currentIncome)}, ${compareToAverage(currentIncome, avgIncome)}.`,
      tone: avgIncome > 0 ? (pct > 5 ? 'positive' : pct < -5 ? 'negative' : 'neutral') : 'neutral',
    });
  }

  // Single largest expense this period - a concrete anchor alongside the aggregate numbers.
  let biggestExpense: { amount: number; description: string; merchantKey: string; date: string } | null = null;
  for (const row of current) {
    const category = categoryOf(row);
    if (!category || effectiveTxnType(row, category) !== 'expense') continue;
    const amount = Number(row.amount);
    if (!biggestExpense || amount > biggestExpense.amount) {
      biggestExpense = { amount, description: row.description_raw, merchantKey: reduceDescription(row.description_raw), date: row.txn_date };
    }
  }
  if (biggestExpense) {
    const name = merchantAliasByKey.get(biggestExpense.merchantKey) ?? biggestExpense.description;
    insights.push({
      id: 'biggest-expense',
      text: `The single largest expense was ${formatCurrency(biggestExpense.amount)} at ${name} on ${formatDate(biggestExpense.date)}.`,
      tone: 'neutral',
    });
  }

  // Pace projection - only meaningful mid-month (projectMonthEnd degenerates to `spent` once the
  // period reaches month-end, which would just restate the first bullet).
  if (pace && currentExpense > 0) {
    const projected = projectMonthEnd(currentExpense, pace.end);
    if (projected > currentExpense * 1.02) {
      insights.push({
        id: 'pace-projection',
        text: `At the current pace, you're on track for about ${formatCurrency(projected)} in expenses this month.`,
        tone: 'neutral',
      });
    }
  }

  return insights;
}

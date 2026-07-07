import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, PiggyBank, Receipt, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { MonthlyTrendChart, type MonthlyTrendPoint } from './monthly-trend-chart';
import { CategoryBarChart, type CategoryAmount } from './category-bar-chart';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Deliberately local-calendar-date formatting, not toISOString() (which converts to UTC and
// would roll a local month-start back a day for any timezone ahead of UTC, e.g. IST).
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface Delta {
  direction: 'up' | 'down' | 'flat';
  label: string;
  isGood: boolean;
}

/** Percentage delta - safe for quantities that are always >= 0 (income, expense). */
function percentDelta(current: number, previous: number, higherIsGood: boolean): Delta | undefined {
  if (previous <= 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { direction: 'flat', label: 'Flat vs last month', isGood: true };
  const direction: Delta['direction'] = pct > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs last month`,
    isGood: direction === 'up' ? higherIsGood : !higherIsGood,
  };
}

/** Absolute currency delta - net savings can be negative, so a percentage would be misleading. */
function absoluteDelta(current: number, previous: number, hasBaseline: boolean): Delta | undefined {
  if (!hasBaseline) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 1) return { direction: 'flat', label: 'Flat vs last month', isGood: true };
  const direction: Delta['direction'] = diff > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))} vs last month`,
    isGood: direction === 'up',
  };
}

export default async function DashboardPage() {
  await requireOwnerUser();
  const supabase = await createClient();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [{ data: categoryTotals }, { data: monthlyTotals }] = await Promise.all([
    supabase
      .from('v_category_totals')
      .select('category_name, category_type, total_amount')
      .eq('month', toDateKey(currentMonthStart)),
    supabase
      .from('v_monthly_totals')
      .select('month, direction, total_amount')
      .gte('month', toDateKey(twelveMonthsAgo)),
  ]);

  const incomeCategories: CategoryAmount[] = (categoryTotals ?? [])
    .filter((c) => c.category_type === 'income')
    .map((c) => ({ name: c.category_name, amount: Number(c.total_amount) }));

  const expenseCategories: CategoryAmount[] = (categoryTotals ?? [])
    .filter((c) => c.category_type === 'expense')
    .map((c) => ({ name: c.category_name, amount: Number(c.total_amount) }));

  const totalIncome = incomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const totalExpense = expenseCategories.reduce((sum, c) => sum + c.amount, 0);

  const previousMonthKey = toDateKey(previousMonthStart);
  const prevIncomeRow = (monthlyTotals ?? []).find((m) => m.month === previousMonthKey && m.direction === 'credit');
  const prevExpenseRow = (monthlyTotals ?? []).find((m) => m.month === previousMonthKey && m.direction === 'debit');
  const prevIncome = prevIncomeRow ? Number(prevIncomeRow.total_amount) : 0;
  const prevExpense = prevExpenseRow ? Number(prevExpenseRow.total_amount) : 0;
  const hasPreviousMonthData = Boolean(prevIncomeRow || prevExpenseRow);

  // All 12 month buckets, including ones with no activity, for a continuous trend line.
  const monthBuckets = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
    return { key: toDateKey(date), label: monthLabel(date) };
  });

  const trendData: MonthlyTrendPoint[] = monthBuckets.map((bucket) => {
    const income = (monthlyTotals ?? []).find((m) => m.month === bucket.key && m.direction === 'credit');
    const expense = (monthlyTotals ?? []).find((m) => m.month === bucket.key && m.direction === 'debit');
    return {
      month: bucket.label,
      income: income ? Number(income.total_amount) : 0,
      expense: expense ? Number(expense.total_amount) : 0,
    };
  });

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{monthLabel(currentMonthStart)}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Income this month"
          value={formatCurrency(totalIncome)}
          icon={Wallet}
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          delta={percentDelta(totalIncome, prevIncome, true)}
        />
        <StatTile
          label="Expense this month"
          value={formatCurrency(totalExpense)}
          icon={Receipt}
          accentClass="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
          delta={percentDelta(totalExpense, prevExpense, false)}
        />
        <StatTile
          label="Net savings this month"
          value={formatCurrency(totalIncome - totalExpense)}
          icon={PiggyBank}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          delta={absoluteDelta(totalIncome - totalExpense, prevIncome - prevExpense, hasPreviousMonthData)}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="font-medium">Income by category</h2>
          <CategoryBarChart data={incomeCategories} color="income" />
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="font-medium">Expense by category</h2>
          <CategoryBarChart data={expenseCategories} color="expense" />
        </Card>
      </section>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-zinc-500" />
          <h2 className="font-medium">Income vs expense - last 12 months</h2>
        </div>
        <MonthlyTrendChart data={trendData} />
      </Card>
    </main>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  accentClass,
  delta,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass: string;
  delta?: Delta;
}) {
  const deltaColorClass = delta
    ? delta.direction === 'flat'
      ? 'text-zinc-500 dark:text-zinc-400'
      : delta.isGood
        ? 'text-emerald-600 dark:text-emerald-500'
        : 'text-red-600 dark:text-red-500'
    : '';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accentClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {delta && (
        <div className={`flex items-center gap-1 text-xs font-medium ${deltaColorClass}`}>
          {delta.direction === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
          {delta.direction === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
          {delta.direction === 'flat' && <Minus className="h-3.5 w-3.5" />}
          <span>{delta.label}</span>
        </div>
      )}
    </Card>
  );
}

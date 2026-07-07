import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { MonthlyTrendChart, type MonthlyTrendPoint } from './monthly-trend-chart';
import { CategoryBarChart, type CategoryAmount } from './category-bar-chart';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default async function DashboardPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [{ data: categoryTotals }, { data: monthlyTotals }] = await Promise.all([
    supabase
      .from('v_category_totals')
      .select('category_name, category_type, total_amount')
      .eq('month', currentMonthStart.toISOString().slice(0, 10)),
    supabase
      .from('v_monthly_totals')
      .select('month, direction, total_amount')
      .gte('month', twelveMonthsAgo.toISOString().slice(0, 10)),
  ]);

  const incomeCategories: CategoryAmount[] = (categoryTotals ?? [])
    .filter((c) => c.category_type === 'income')
    .map((c) => ({ name: c.category_name, amount: Number(c.total_amount) }));

  const expenseCategories: CategoryAmount[] = (categoryTotals ?? [])
    .filter((c) => c.category_type === 'expense')
    .map((c) => ({ name: c.category_name, amount: Number(c.total_amount) }));

  const totalIncome = incomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const totalExpense = expenseCategories.reduce((sum, c) => sum + c.amount, 0);

  // All 12 month buckets, including ones with no activity, for a continuous trend line.
  const monthBuckets = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
    return { key: date.toISOString().slice(0, 10), label: monthLabel(date) };
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
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Signed in as {user.email}</p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Income this month" value={formatCurrency(totalIncome)} />
        <StatTile label="Expense this month" value={formatCurrency(totalExpense)} />
        <StatTile label="Net savings this month" value={formatCurrency(totalIncome - totalExpense)} />
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Income by category</h2>
          <CategoryBarChart data={incomeCategories} color="income" />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Expense by category</h2>
          <CategoryBarChart data={expenseCategories} color="expense" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Income vs expense - last 12 months</h2>
        <MonthlyTrendChart data={trendData} />
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

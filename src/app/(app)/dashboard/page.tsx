import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import type { TxnType } from '@/lib/transactions/type';
import { aggregateByCategory, computeSavingsRate, sumByType } from '@/lib/transactions/aggregate';
import { DashboardFilters } from './filters';
import { MonthlyTrendChart, type MonthlyTrendPoint } from './monthly-trend-chart';
import { CategoryDonutChart } from './category-donut-chart';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Deliberately local-calendar-date formatting, not toISOString() (which converts to UTC and
// would roll a local date back a day for any timezone ahead of UTC, e.g. IST).
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  if (Math.abs(pct) < 0.5) return { direction: 'flat', label: 'Flat vs previous period', isGood: true };
  const direction: Delta['direction'] = pct > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs previous period`,
    isGood: direction === 'up' ? higherIsGood : !higherIsGood,
  };
}

/** Absolute currency delta - net savings can be negative, so a percentage would be misleading. */
function absoluteDelta(current: number, previous: number, hasBaseline: boolean): Delta | undefined {
  if (!hasBaseline) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 1) return { direction: 'flat', label: 'Flat vs previous period', isGood: true };
  const direction: Delta['direction'] = diff > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))} vs previous period`,
    isGood: direction === 'up',
  };
}

/** Percentage-point delta - for a value that's already a percentage (savings rate). */
function pointsDelta(current: number, previous: number, hasBaseline: boolean): Delta | undefined {
  if (!hasBaseline) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return { direction: 'flat', label: 'Flat vs previous period', isGood: true };
  const direction: Delta['direction'] = diff > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${diff > 0 ? '+' : ''}${diff.toFixed(0)}pp vs previous period`,
    isGood: direction === 'up',
  };
}

export interface TxnRow {
  amount: number;
  txn_type_override: TxnType | null;
  category_id: string;
  categories: { name: string; txn_type: TxnType }[] | { name: string; txn_type: TxnType } | null;
}

interface TrendTxnRow {
  amount: number;
  txn_date: string;
  txn_type_override: TxnType | null;
  categories: { txn_type: TxnType }[] | { txn_type: TxnType } | null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; accountId?: string }>;
}) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const params = await searchParams;

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const start = params.start ? parseDateKey(params.start) : defaultStart;
  const end = params.end ? parseDateKey(params.end) : today;
  const accountId = params.accountId ?? '';

  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - rangeDays + 1);

  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const TXN_SELECT = 'amount, txn_type_override, category_id, categories(name, txn_type)';

  let currentQuery = supabase
    .from('transactions')
    .select(TXN_SELECT)
    .gte('txn_date', toDateKey(start))
    .lte('txn_date', toDateKey(end));
  let previousQuery = supabase
    .from('transactions')
    .select(TXN_SELECT)
    .gte('txn_date', toDateKey(previousStart))
    .lte('txn_date', toDateKey(previousEnd));
  let trendQuery = supabase
    .from('transactions')
    .select('amount, txn_date, txn_type_override, categories(txn_type)')
    .gte('txn_date', toDateKey(twelveMonthsAgo));

  if (accountId) {
    currentQuery = currentQuery.eq('account_id', accountId);
    previousQuery = previousQuery.eq('account_id', accountId);
    trendQuery = trendQuery.eq('account_id', accountId);
  }

  const [{ data: accounts }, { data: currentRows }, { data: previousRows }, { data: trendRows }] = await Promise.all([
    supabase.from('accounts').select('id, display_name').eq('user_id', user.id).order('created_at', { ascending: true }),
    currentQuery,
    previousQuery,
    trendQuery,
  ]);

  const current = (currentRows ?? []) as TxnRow[];
  const previous = (previousRows ?? []) as TxnRow[];

  const incomeCategories = aggregateByCategory(current, 'income');
  const expenseCategories = aggregateByCategory(current, 'expense');
  const totalIncome = sumByType(current, 'income');
  const totalExpense = sumByType(current, 'expense');
  const totalInvestment = sumByType(current, 'investment');
  const prevIncome = sumByType(previous, 'income');
  const prevExpense = sumByType(previous, 'expense');
  const prevInvestment = sumByType(previous, 'investment');
  const hasPreviousData = previous.length > 0;

  const savingsRate = computeSavingsRate(totalIncome, totalExpense);
  const prevSavingsRate = computeSavingsRate(prevIncome, prevExpense);

  // All 12 month buckets, including ones with no activity, for a continuous trend line.
  const monthBuckets = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { startKey: toDateKey(date), endKey: toDateKey(monthEnd), label: monthLabel(date) };
  });

  const trendRowsTyped = (trendRows ?? []) as TrendTxnRow[];

  const trendData: MonthlyTrendPoint[] = monthBuckets.map((bucket) => {
    const rowsInMonth = trendRowsTyped.filter((r) => r.txn_date >= bucket.startKey && r.txn_date <= bucket.endKey);
    return {
      month: bucket.label,
      income: sumByType(rowsInMonth, 'income'),
      expense: sumByType(rowsInMonth, 'expense'),
    };
  });

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} &ndash;{' '}
          {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <DashboardFilters
        accounts={accounts ?? []}
        start={toDateKey(start)}
        end={toDateKey(end)}
        accountId={accountId}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Income"
          value={formatCurrency(totalIncome)}
          icon={Wallet}
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          delta={percentDelta(totalIncome, prevIncome, true)}
        />
        <StatTile
          label="Expense"
          value={formatCurrency(totalExpense)}
          icon={Receipt}
          accentClass="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
          delta={percentDelta(totalExpense, prevExpense, false)}
        />
        <StatTile
          label="Net savings"
          value={formatCurrency(totalIncome - totalExpense)}
          icon={PiggyBank}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          delta={absoluteDelta(totalIncome - totalExpense, prevIncome - prevExpense, hasPreviousData)}
        />
        <StatTile
          label="Savings rate"
          value={savingsRate !== null ? `${savingsRate.toFixed(0)}%` : 'N/A'}
          icon={BarChart3}
          accentClass="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          delta={savingsRate !== null && prevSavingsRate !== null ? pointsDelta(savingsRate, prevSavingsRate, hasPreviousData) : undefined}
        />
        <StatTile
          label="Invested this period"
          value={formatCurrency(totalInvestment)}
          icon={TrendingUp}
          accentClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400"
          delta={absoluteDelta(totalInvestment, prevInvestment, hasPreviousData)}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-medium">Income by category</h2>
          <CategoryDonutChart data={incomeCategories} />
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-medium">Expense by category</h2>
          <CategoryDonutChart data={expenseCategories} />
        </Card>
      </section>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
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
      ? 'text-muted-foreground'
      : delta.isGood
        ? 'text-emerald-600 dark:text-emerald-500'
        : 'text-destructive'
    : '';

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accentClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
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

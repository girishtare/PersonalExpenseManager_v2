import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { after } from 'next/server';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import type { TxnType } from '@/lib/transactions/type';
import { aggregateByCategory, categoryOf, computeSavingsRate, sumByType } from '@/lib/transactions/aggregate';
import { effectiveTxnType } from '@/lib/transactions/type';
import { computeMtdBadge, parseDateKey, sameDaysLastMonth, toDateKey, type MtdBadge } from '@/lib/dashboard/period';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { detectRecurringDebits, type RecurrenceTxn } from '@/lib/dashboard/recurrence';
import { computeTopMerchants } from '@/lib/dashboard/merchants';
import { DashboardFilters } from './filters';
import { MonthlyTrendChart, type MonthlyTrendPoint } from './monthly-trend-chart';
import { CategoryDonutChart } from './category-donut-chart';
import { UpcomingDebitsCard } from './upcoming-debits-card';
import { TopMerchantsTable } from './top-merchants-table';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * If the "live" Gmail connection hasn't synced in the last 24h (or never has), kicks off a sync
 * in the background via after() - runs after this page's response is already sent, so it never
 * adds latency to a dashboard visit. Reuses /api/gmail/sync's own "already running?" guard (see
 * that route), so it's safe to call on every visit even if an earlier auto-trigger or a manual
 * "Sync now" click is still in flight.
 */
async function maybeAutoSyncLiveMailbox(supabase: SupabaseClient, userId: string) {
  const { data: live } = await supabase
    .from('email_connections')
    .select('id, sync_status, last_synced_at')
    .eq('user_id', userId)
    .eq('role', 'live')
    .maybeSingle();
  if (!live || live.sync_status === 'running') return;

  const isStale = !live.last_synced_at || Date.now() - new Date(live.last_synced_at).getTime() > AUTO_SYNC_INTERVAL_MS;
  if (!isStale) return;

  const host = (await headers()).get('host');
  if (!host) return;
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;
  const connectionId = live.id;

  after(async () => {
    await fetch(`${origin}/api/gmail/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INTERNAL_SYNC_SECRET}` },
      body: JSON.stringify({ connectionId }),
    }).catch(() => {});
  });
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

interface Delta {
  direction: 'up' | 'down' | 'flat';
  label: string;
  isGood: boolean;
}

const VS_LABEL = 'vs same days last month';

/** Percentage delta - safe for quantities that are always >= 0 (income, expense). */
function percentDelta(current: number, previous: number, higherIsGood: boolean): Delta | undefined {
  if (previous <= 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { direction: 'flat', label: `Flat ${VS_LABEL}`, isGood: true };
  const direction: Delta['direction'] = pct > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% ${VS_LABEL}`,
    isGood: direction === 'up' ? higherIsGood : !higherIsGood,
  };
}

/** Absolute currency delta - net savings can be negative, so a percentage would be misleading. */
function absoluteDelta(current: number, previous: number, hasBaseline: boolean): Delta | undefined {
  if (!hasBaseline) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 1) return { direction: 'flat', label: `Flat ${VS_LABEL}`, isGood: true };
  const direction: Delta['direction'] = diff > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))} ${VS_LABEL}`,
    isGood: direction === 'up',
  };
}

/** Percentage-point delta - for a value that's already a percentage (savings rate). */
function pointsDelta(current: number, previous: number, hasBaseline: boolean): Delta | undefined {
  if (!hasBaseline) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return { direction: 'flat', label: `Flat ${VS_LABEL}`, isGood: true };
  const direction: Delta['direction'] = diff > 0 ? 'up' : 'down';
  return {
    direction,
    label: `${diff > 0 ? '+' : ''}${diff.toFixed(0)}pp ${VS_LABEL}`,
    isGood: direction === 'up',
  };
}

export interface TxnRow {
  amount: number;
  txn_type_override: TxnType | null;
  category_id: string;
  description_raw: string;
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

  await maybeAutoSyncLiveMailbox(supabase, user.id);

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const start = params.start ? parseDateKey(params.start) : defaultStart;
  const end = params.end ? parseDateKey(params.end) : today;
  const accountId = params.accountId ?? '';

  const { start: prevStart, end: prevEnd } = sameDaysLastMonth(start, end);
  const mtdBadge: MtdBadge | null = computeMtdBadge(start, end);

  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const TXN_SELECT = 'amount, txn_type_override, category_id, description_raw, categories(name, txn_type)';

  // All four transaction queries go through fetchAllRows - the 12-month ones already exceed
  // PostgREST's silent 1000-row cap (which blanked the trend chart's recent months and the
  // recurring-debits card once the dataset grew past 1000), and the period-scoped ones are one
  // long custom date range away from the same fate.
  const currentQuery = () => {
    const q = supabase.from('transactions').select(TXN_SELECT).gte('txn_date', toDateKey(start)).lte('txn_date', toDateKey(end));
    return accountId ? q.eq('account_id', accountId) : q;
  };
  const previousQuery = () => {
    const q = supabase.from('transactions').select(TXN_SELECT).gte('txn_date', toDateKey(prevStart)).lte('txn_date', toDateKey(prevEnd));
    return accountId ? q.eq('account_id', accountId) : q;
  };
  const trendQuery = () => {
    const q = supabase
      .from('transactions')
      .select('amount, txn_date, txn_type_override, categories(txn_type)')
      .gte('txn_date', toDateKey(twelveMonthsAgo));
    return accountId ? q.eq('account_id', accountId) : q;
  };
  // Upcoming known debits are always about "what's coming up from now", independent of the
  // selected viewing range - same convention as the 12-month trend always showing the last 12
  // real months regardless of the date filter.
  const recurrenceQuery = () => {
    const q = supabase
      .from('transactions')
      .select('txn_date, amount, direction, description_raw')
      .eq('direction', 'debit')
      .gte('txn_date', toDateKey(twelveMonthsAgo))
      .lte('txn_date', toDateKey(today));
    return accountId ? q.eq('account_id', accountId) : q;
  };

  const [{ data: accounts }, currentRows, previousRows, trendRows, recurrenceRows, { data: merchantAliases }] = await Promise.all([
    supabase.from('accounts').select('id, display_name').eq('user_id', user.id).order('created_at', { ascending: true }),
    fetchAllRows(currentQuery),
    fetchAllRows(previousQuery),
    fetchAllRows(trendQuery),
    fetchAllRows(recurrenceQuery),
    supabase.from('merchant_aliases').select('merchant_key, display_name').eq('user_id', user.id),
  ]);

  const merchantAliasByKey = new Map((merchantAliases ?? []).map((a) => [a.merchant_key, a.display_name]));

  const current = currentRows as TxnRow[];
  const previous = previousRows as TxnRow[];

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

  const upcomingDebits = detectRecurringDebits((recurrenceRows ?? []) as RecurrenceTxn[], today);

  // "Merchants" means places you spend, not internal transfers/bill payments - a CC Bill
  // Payment would otherwise dominate this table as the single biggest "merchant".
  const isExpenseRow = (row: TxnRow) => {
    const category = categoryOf(row);
    return !!category && effectiveTxnType(row, category) === 'expense';
  };
  const topMerchants = computeTopMerchants(current.filter(isExpenseRow), previous.filter(isExpenseRow)).map((row) => ({
    ...row,
    name: merchantAliasByKey.get(row.key) ?? row.name,
  }));

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
          mtdBadge={mtdBadge}
        />
        <StatTile
          label="Expense"
          value={formatCurrency(totalExpense)}
          icon={Receipt}
          accentClass="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
          delta={percentDelta(totalExpense, prevExpense, false)}
          mtdBadge={mtdBadge}
        />
        <StatTile
          label="Net savings"
          value={formatCurrency(totalIncome - totalExpense)}
          icon={PiggyBank}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          delta={absoluteDelta(totalIncome - totalExpense, prevIncome - prevExpense, hasPreviousData)}
          mtdBadge={mtdBadge}
        />
        <StatTile
          label="Savings rate"
          value={savingsRate !== null ? `${savingsRate.toFixed(0)}%` : 'N/A'}
          icon={BarChart3}
          accentClass="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          delta={savingsRate !== null && prevSavingsRate !== null ? pointsDelta(savingsRate, prevSavingsRate, hasPreviousData) : undefined}
          mtdBadge={mtdBadge}
        />
        <StatTile
          label="Invested this period"
          value={formatCurrency(totalInvestment)}
          icon={TrendingUp}
          accentClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400"
          delta={absoluteDelta(totalInvestment, prevInvestment, hasPreviousData)}
          mtdBadge={mtdBadge}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-medium">Upcoming known debits</h2>
          <UpcomingDebitsCard debits={upcomingDebits} />
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-medium">Expense by category</h2>
          <CategoryDonutChart data={expenseCategories} />
        </Card>
      </section>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-medium">Top merchants</h2>
        <TopMerchantsTable rows={topMerchants} />
      </Card>

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
  mtdBadge,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass: string;
  delta?: Delta;
  mtdBadge: MtdBadge | null;
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accentClass}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        {mtdBadge && (
          <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            MTD &middot; day {mtdBadge.day} of {mtdBadge.totalDays}
          </span>
        )}
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

'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MerchantNameCell } from '@/components/merchant-name-cell';
import { parseDateKey } from '@/lib/dashboard/period';
import type { CategoryMonthlyTrend } from '@/lib/dashboard/category-trend';
import { CHART_COLORS } from './chart-colors';

const formatAmount = (value: unknown) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatDate = (dateKey: string) => parseDateKey(dateKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type CategoryMonthlyTxnWithAlias = CategoryMonthlyTrend['months'][number]['transactions'][number] & { aliasName: string | null };

type MonthBar = Omit<CategoryMonthlyTrend['months'][number], 'transactions'> & { transactions: CategoryMonthlyTxnWithAlias[] };

type CategoryMonthlyTrendWithAliases = Omit<CategoryMonthlyTrend, 'months'> & { months: MonthBar[] };

function totalOf(category: CategoryMonthlyTrend): number {
  return category.months.reduce((sum, m) => sum + m.amount, 0);
}

export function CategoryTrendChart({ data }: { data: CategoryMonthlyTrendWithAliases[] }) {
  const colors = CHART_COLORS[useTheme()];
  // Default to the category with the highest 12-month spend, so the chart isn't empty on load.
  const [categoryId, setCategoryId] = useState<string>(() => {
    if (data.length === 0) return '';
    return [...data].sort((a, b) => totalOf(b) - totalOf(a))[0].categoryId;
  });
  const [drilldownMonth, setDrilldownMonth] = useState<MonthBar | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No expense data for the last 12 months yet.</p>;
  }

  const selected = data.find((c) => c.categoryId === categoryId) ?? data[0];

  return (
    <div className="flex flex-col gap-4">
      <Select
        items={data.map((c) => ({ value: c.categoryId, label: c.categoryName }))}
        value={selected.categoryId}
        onValueChange={(v) => v && setCategoryId(v)}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {data.map((c) => (
            <SelectItem key={c.categoryId} value={c.categoryId}>
              {c.categoryName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={selected.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.gridline} />
          <XAxis
            dataKey="month"
            tick={{ fill: colors.textSecondary, fontSize: 12 }}
            axisLine={{ stroke: colors.gridline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: colors.textSecondary, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAmount}
            width={56}
          />
          <Tooltip formatter={formatAmount} contentStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="amount"
            name={selected.categoryName}
            fill={colors.expense}
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(bar) => {
              const month = bar.payload as MonthBar | undefined;
              if (month && month.transactions.length > 0) setDrilldownMonth(month);
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      <Dialog open={!!drilldownMonth} onOpenChange={(open) => !open && setDrilldownMonth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected.categoryName} &middot; {drilldownMonth?.month}
            </DialogTitle>
          </DialogHeader>
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {drilldownMonth?.transactions.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                <div className="min-w-0">
                  <MerchantNameCell merchantKey={t.merchantKey} descriptionRaw={t.description} aliasName={t.aliasName} />
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">{formatAmount(t.amount)}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

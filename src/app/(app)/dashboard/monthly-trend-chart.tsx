'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePrefersDark } from '@/lib/use-prefers-dark';
import { CHART_COLORS } from './chart-colors';

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
}

const formatAmount = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const colors = CHART_COLORS[usePrefersDark() ? 'dark' : 'light'];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

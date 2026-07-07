'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { CHART_COLORS } from './chart-colors';

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
}

const formatAmount = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const colors = CHART_COLORS[useTheme()];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.income} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.income} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.expense} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="income"
          name="Income"
          stroke={colors.income}
          strokeWidth={2}
          fill="url(#incomeFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="expense"
          name="Expense"
          stroke={colors.expense}
          strokeWidth={2}
          fill="url(#expenseFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

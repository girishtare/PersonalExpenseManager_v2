'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CategoryMonthlyTrend } from '@/lib/dashboard/category-trend';
import { CHART_COLORS } from './chart-colors';

const formatAmount = (value: unknown) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

function totalOf(category: CategoryMonthlyTrend): number {
  return category.months.reduce((sum, m) => sum + m.amount, 0);
}

export function CategoryTrendChart({ data }: { data: CategoryMonthlyTrend[] }) {
  const colors = CHART_COLORS[useTheme()];
  // Default to the category with the highest 12-month spend, so the chart isn't empty on load.
  const [categoryId, setCategoryId] = useState<string>(() => {
    if (data.length === 0) return '';
    return [...data].sort((a, b) => totalOf(b) - totalOf(a))[0].categoryId;
  });

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
          <Bar dataKey="amount" name={selected.categoryName} fill={colors.expense} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

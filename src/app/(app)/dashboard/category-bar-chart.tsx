'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePrefersDark } from '@/lib/use-prefers-dark';
import { CHART_COLORS } from './chart-colors';

export interface CategoryAmount {
  name: string;
  amount: number;
}

const MAX_ROWS = 7;

/** Past the token ceiling (7-8 series), fold the tail into "Other" rather than adding more hues. */
function foldTopCategories(items: CategoryAmount[]): CategoryAmount[] {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_ROWS) return sorted;

  const top = sorted.slice(0, MAX_ROWS);
  const otherTotal = sorted.slice(MAX_ROWS).reduce((sum, item) => sum + item.amount, 0);
  return otherTotal > 0 ? [...top, { name: 'Other', amount: otherTotal }] : top;
}

const formatAmount = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

export function CategoryBarChart({ data, color }: { data: CategoryAmount[]; color: 'income' | 'expense' }) {
  const colors = CHART_COLORS[usePrefersDark() ? 'dark' : 'light'];
  const rows = foldTopCategories(data);
  const barColor = color === 'income' ? colors.categoryIncome : colors.categoryExpense;

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No data for this period yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(rows.length * 36, 80)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={colors.gridline} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: colors.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip formatter={formatAmount} contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', formatter: formatAmount, fill: colors.textSecondary, fontSize: 12 }}>
          {rows.map((row) => (
            <Cell key={row.name} fill={row.name === 'Other' ? colors.other : barColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

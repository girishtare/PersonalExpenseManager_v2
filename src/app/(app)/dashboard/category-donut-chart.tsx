'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { CHART_COLORS } from './chart-colors';

export interface CategoryAmount {
  name: string;
  amount: number;
}

const MAX_SLICES = 7;

/** Past the token ceiling (7-8 series), fold the tail into "Other" rather than adding more hues. */
function foldTopCategories(items: CategoryAmount[]): CategoryAmount[] {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_SLICES) return sorted;

  const top = sorted.slice(0, MAX_SLICES);
  const otherTotal = sorted.slice(MAX_SLICES).reduce((sum, item) => sum + item.amount, 0);
  return otherTotal > 0 ? [...top, { name: 'Other', amount: otherTotal }] : top;
}

const formatAmount = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

export function CategoryDonutChart({ data }: { data: CategoryAmount[] }) {
  const colors = CHART_COLORS[useTheme()];
  const rows = foldTopCategories(data);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  if (rows.length === 0 || total === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="amount"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
          label={({ percent }) => ((percent ?? 0) >= 0.06 ? `${Math.round((percent ?? 0) * 100)}%` : '')}
          labelLine={false}
        >
          {rows.map((row, i) => (
            <Cell key={row.name} fill={row.name === 'Other' ? colors.other : colors.categorical[i % 8]} />
          ))}
        </Pie>
        <Tooltip formatter={formatAmount} contentStyle={{ fontSize: 12 }} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, lineHeight: '20px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

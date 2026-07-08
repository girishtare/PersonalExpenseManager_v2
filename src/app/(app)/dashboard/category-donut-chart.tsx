'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { CHART_COLORS } from './chart-colors';

export interface CategoryAmount {
  name: string;
  amount: number;
}

const OTHER_THRESHOLD = 0.03;
// Palette ceiling (chart-colors.ts has 8 categorical hues) - a pure %-cutoff alone could still
// leave more than 8 "real" slices in a period with many similarly-sized categories, which would
// wrap and reuse colors. Both constraints apply together: fold anything under 3%, and cap the
// rest at 7 (plus "Other") so colors never repeat.
const MAX_SLICES = 7;

/** Slices under 3% of the total, or past the 7-slice ceiling, are folded into "Other". */
function foldTopCategories(items: CategoryAmount[]): CategoryAmount[] {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return sorted;

  const kept: CategoryAmount[] = [];
  let otherTotal = 0;
  for (const item of sorted) {
    if (item.amount / total < OTHER_THRESHOLD || kept.length >= MAX_SLICES) otherTotal += item.amount;
    else kept.push(item);
  }
  return otherTotal > 0 ? [...kept, { name: 'Other', amount: otherTotal }] : kept;
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
          label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
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

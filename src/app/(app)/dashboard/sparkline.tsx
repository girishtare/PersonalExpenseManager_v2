'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '@/lib/use-theme';
import { CHART_COLORS } from './chart-colors';

const formatAmount = (value: unknown) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

/** A compact inline trend line for a table row - no axes/gridlines, just the shape, with a
 * lightweight hover tooltip so the underlying month/amount is still available on demand. */
export function Sparkline({ months }: { months: { month: string; amount: number }[] }) {
  const colors = CHART_COLORS[useTheme()];

  return (
    <div style={{ width: 88, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={months} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
          <Tooltip
            formatter={formatAmount}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 11, padding: '4px 8px' }}
            wrapperStyle={{ zIndex: 50 }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={colors.expense}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

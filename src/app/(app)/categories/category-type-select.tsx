'use client';

import { useState, useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TxnType } from '@/lib/transactions/type';
import { updateCategoryTxnType } from './actions';

const TXN_TYPE_LABELS: Record<TxnType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  investment: 'Investment',
};

/**
 * Always-visible Type selector for a category, so transactions in it know what to auto-pick-up
 * (see effectiveTxnType) without having to open the rename popover to find it.
 */
export function CategoryTypeSelect({ categoryId, txnType }: { categoryId: string; txnType: TxnType }) {
  const [value, setValue] = useState<TxnType>(txnType);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-0.5">
      <Select
        items={Object.entries(TXN_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))}
        value={value}
        disabled={isPending}
        onValueChange={(v) => {
          if (!v) return;
          const next = v as TxnType;
          setValue(next);
          startTransition(async () => {
            const result = await updateCategoryTxnType(categoryId, next);
            setError(result.error ?? null);
          });
        }}
      >
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(TXN_TYPE_LABELS) as [TxnType, string][]).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

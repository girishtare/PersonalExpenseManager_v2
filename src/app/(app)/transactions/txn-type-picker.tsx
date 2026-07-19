'use client';

import { useState, useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TxnType } from '@/lib/transactions/type';
import { updateTransactionTxnTypeOverride } from './actions';

const AUTO = '__auto__';

const TXN_TYPE_LABELS: Record<TxnType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  investment: 'Investment',
};

/**
 * Lets a transaction override its category's default txn_type - for one-off exceptions (e.g. a
 * self-transfer that landed under a generic category). "Auto" clears the override and falls
 * back to the category's txn_type (see effectiveTxnType).
 */
export function TxnTypePicker({
  transactionId,
  txnTypeOverride,
  categoryTxnType,
}: {
  transactionId: string;
  txnTypeOverride: TxnType | null;
  categoryTxnType: TxnType;
}) {
  const [value, setValue] = useState<string>(txnTypeOverride ?? AUTO);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const items = [
    { value: AUTO, label: `Auto (${TXN_TYPE_LABELS[categoryTxnType]})` },
    ...(Object.entries(TXN_TYPE_LABELS) as [TxnType, string][]).map(([v, label]) => ({ value: v, label })),
  ];

  return (
    <div className="flex flex-col gap-0.5">
      <Select
        items={items}
        value={value}
        disabled={isPending}
        onValueChange={(v) => {
          if (!v) return;
          const previous = value;
          setValue(v);
          setError(null);
          startTransition(async () => {
            try {
              await updateTransactionTxnTypeOverride(transactionId, v === AUTO ? null : (v as TxnType));
            } catch (err) {
              // Without try/catch here, startTransition silently drops the error and the
              // dropdown is left showing a value that was never actually saved.
              setValue(previous);
              setError(err instanceof Error ? err.message : 'Could not update type. Please try again.');
            }
          });
        }}
      >
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

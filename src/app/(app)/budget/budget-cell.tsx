'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertBudget } from './budget-actions';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function BudgetCell({ categoryId, amount }: { categoryId: string; amount: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="tabular-nums">{formatCurrency(amount)}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setValue(amount > 0 ? String(amount) : '');
            setError(null);
            setEditing(true);
          }}
        >
          {amount > 0 ? 'Edit' : 'Set budget'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          autoFocus
          className="h-8 w-28 text-right tabular-nums"
        />
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const next = Number(value) || 0;
              const result = await upsertBudget(categoryId, next);
              if (result.error) {
                setError(result.error);
                return;
              }
              setError(null);
              setEditing(false);
            })
          }
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

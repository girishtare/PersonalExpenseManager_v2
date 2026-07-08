'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertBudget } from './budget-actions';

export function BudgetInput({ categoryId, initialAmount }: { categoryId: string; initialAmount: number }) {
  const initialText = initialAmount > 0 ? String(initialAmount) : '';
  const [value, setValue] = useState(initialText);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== initialText;

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
          placeholder="Set budget"
          className="h-8 w-28 text-right tabular-nums"
        />
        {dirty && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={isPending}
            aria-label="Save budget"
            onClick={() =>
              startTransition(async () => {
                const amount = Number(value) || 0;
                const result = await upsertBudget(categoryId, amount);
                setError(result.error ?? null);
              })
            }
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

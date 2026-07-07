'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { recalculateCategories } from './actions';

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await recalculateCategories();
            setMessage('error' in result ? result.error : `Updated ${result.updatedCount} transactions.`);
          })
        }
      >
        {isPending ? 'Recalculating…' : 'Recalculate categories'}
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

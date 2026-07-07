'use client';

import { useState, useTransition } from 'react';
import { recalculateCategories } from './actions';

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await recalculateCategories();
            setMessage('error' in result ? result.error : `Updated ${result.updatedCount} transactions.`);
          })
        }
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isPending ? 'Recalculating…' : 'Recalculate categories'}
      </button>
      {message && <span className="text-sm text-zinc-600 dark:text-zinc-400">{message}</span>}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteRule } from './actions';

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-destructive"
        disabled={isPending}
        onClick={() => {
          setError(null);
          // Errors inside startTransition are otherwise swallowed silently - catch and surface.
          startTransition(async () => {
            try {
              const result = await deleteRule(ruleId);
              if (result.error) setError(result.error);
            } catch {
              setError('Something went wrong. Please try again.');
            }
          });
        }}
      >
        {isPending ? 'Removing…' : 'Remove'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteRule } from './actions';

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-destructive"
      disabled={isPending}
      onClick={() => startTransition(() => deleteRule(ruleId))}
    >
      {isPending ? 'Removing…' : 'Remove'}
    </Button>
  );
}

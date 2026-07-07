'use client';

import { useTransition } from 'react';
import { deleteRule } from './actions';

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteRule(ruleId))}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? 'Removing…' : 'Remove'}
    </button>
  );
}

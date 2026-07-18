'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { disconnectGmail } from './actions';

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await disconnectGmail(connectionId);
            setError(result.error ?? null);
          })
        }
      >
        {isPending ? 'Disconnecting…' : 'Disconnect'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

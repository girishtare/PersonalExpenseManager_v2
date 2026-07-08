'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

interface ProgressLine {
  status?: string;
  done?: boolean;
  updatedCount?: number;
  error?: string;
}

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch('/api/recalculate', { method: 'POST' });
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed: ProgressLine = JSON.parse(line);
            if (parsed.error) setMessage(parsed.error);
            else if (parsed.done) setMessage(`Updated ${parsed.updatedCount} transactions.`);
            else if (parsed.status) setMessage(parsed.status);
          }
        }
      } catch {
        setMessage('Something went wrong while recalculating. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={isPending} onClick={handleClick}>
        {isPending ? 'Recalculating…' : 'Recalculate categories'}
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

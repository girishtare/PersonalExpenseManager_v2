'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface SyncResponse {
  done: boolean;
  nextPageToken: string | null;
  resultSizeEstimate: number;
  processedThisBatch: number;
  imported: number;
  duplicates: number;
  skipped: number;
  unmatchedAccount: number;
  error?: string;
}

interface Totals {
  processed: number;
  total: number;
  imported: number;
  duplicates: number;
  skipped: number;
  unmatchedAccount: number;
}

const ZERO_TOTALS: Totals = { processed: 0, total: 0, imported: 0, duplicates: 0, skipped: 0, unmatchedAccount: 0 };

export function SyncButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setError(null);
    let running: Totals = ZERO_TOTALS;
    setTotals(running);

    let pageToken: string | undefined;
    try {
      for (;;) {
        const res = await fetch('/api/gmail/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, pageToken }),
        });
        const data: SyncResponse = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Sync failed.');
          break;
        }

        running = {
          processed: running.processed + data.processedThisBatch,
          total: Math.max(data.resultSizeEstimate, running.processed + data.processedThisBatch),
          imported: running.imported + data.imported,
          duplicates: running.duplicates + data.duplicates,
          skipped: running.skipped + data.skipped,
          unmatchedAccount: running.unmatchedAccount + data.unmatchedAccount,
        };
        setTotals(running);

        if (data.done) break;
        pageToken = data.nextPageToken ?? undefined;
      }
    } catch {
      setError('Something went wrong while syncing. Please try again.');
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  const pct = totals && totals.total > 0 ? Math.min(100, Math.round((totals.processed / totals.total) * 100)) : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" size="sm" variant="outline" disabled={syncing} onClick={runSync}>
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>

      {syncing && totals && (
        <div className="w-48">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {totals.processed} of ~{totals.total}
          </p>
        </div>
      )}

      {!syncing && totals && !error && (
        <p className="text-xs text-muted-foreground">
          Imported {totals.imported}
          {totals.duplicates > 0 && ` · ${totals.duplicates} already had`}
          {totals.skipped > 0 && ` · ${totals.skipped} not recognized`}
          {totals.unmatchedAccount > 0 && ` · ${totals.unmatchedAccount} unknown account`}
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

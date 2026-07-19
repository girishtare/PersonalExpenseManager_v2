'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getConnectionSyncStatus, type SyncStatus } from './actions';

const POLL_INTERVAL_MS = 2000;

export function SyncButton({ connectionId, initialStatus }: { connectionId: string; initialStatus: SyncStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [startError, setStartError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(options?: { waitForStart?: boolean }) {
    stopPolling();
    // When polling begins the instant a sync is kicked off, the first poll can land before the
    // server has flipped sync_status to 'running' - without this grace logic that stale 'idle'
    // would immediately stop the polling loop again.
    let sawRunning = !options?.waitForStart;
    let polls = 0;
    pollRef.current = setInterval(async () => {
      const latest = await getConnectionSyncStatus(connectionId);
      if (!latest) return;
      polls++;
      if (latest.status === 'running') sawRunning = true;
      setStatus(latest);
      if (latest.status !== 'running' && (sawRunning || polls >= 5)) {
        stopPolling();
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    // The sync itself runs server-side regardless of this page being open (see
    // /api/gmail/sync's self-chaining) - if it was already running when this page loaded
    // (e.g. the user navigated away and came back), just resume watching it.
    if (initialStatus.status === 'running') startPolling();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    setStartError(null);
    setStatus((s) => ({ ...s, status: 'running', processed: 0, total: 0 }));
    // Poll from the very start - the kickoff request below stays busy processing batches for up
    // to ~a minute before responding, and the DB-backed progress is live the whole time.
    startPolling({ waitForStart: true });
    try {
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        stopPolling();
        setStartError(data.error ?? 'Sync failed.');
        setStatus((s) => ({ ...s, status: 'error' }));
      }
    } catch {
      // The kickoff request aborts if the user navigates away mid-run - the sync itself keeps
      // going server-side, so only report a failure if we're still around to know better.
      const latest = await getConnectionSyncStatus(connectionId).catch(() => null);
      if (latest && latest.status !== 'running') {
        stopPolling();
        setStartError('Something went wrong while starting the sync. Please try again.');
        setStatus((s) => ({ ...s, status: 'error' }));
      }
    }
  }

  const syncing = status.status === 'running';
  const pct = status.total > 0 ? Math.min(100, Math.round((status.processed / status.total) * 100)) : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" size="sm" variant="outline" disabled={syncing} onClick={handleClick}>
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>

      {syncing && (
        <div className="w-48">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {status.processed} of ~{status.total}
          </p>
        </div>
      )}

      {!syncing && status.status === 'idle' && (status.imported || status.duplicates || status.skipped || status.unmatchedAccount) ? (
        <p className="text-xs text-muted-foreground">
          Imported {status.imported}
          {status.duplicates > 0 && ` · ${status.duplicates} already had`}
          {status.skipped > 0 && ` · ${status.skipped} not recognized`}
          {status.unmatchedAccount > 0 && ` · ${status.unmatchedAccount} unknown account`}
        </p>
      ) : null}

      {(startError || status.error) && <p className="text-xs text-destructive">{startError ?? status.error}</p>}
    </div>
  );
}

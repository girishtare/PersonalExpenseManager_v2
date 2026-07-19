'use client';

import { useEffect, useState } from 'react';
import { getAnySyncRunning } from './settings/actions';

const POLL_INTERVAL_MS = 8000;

/** Shows in the shared header while any Gmail connection is mid-sync (manual or auto-triggered) - polls
 * lightly since this is a passive ambient indicator, not an actively-watched progress bar (see SyncButton
 * for that). */
export function SyncIndicator({ initialSyncing }: { initialSyncing: boolean }) {
  const [syncing, setSyncing] = useState(initialSyncing);

  useEffect(() => {
    const interval = setInterval(() => {
      getAnySyncRunning()
        .then(setSyncing)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!syncing) return null;

  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-500">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600 dark:bg-emerald-500" />
      Syncing Gmail…
    </span>
  );
}

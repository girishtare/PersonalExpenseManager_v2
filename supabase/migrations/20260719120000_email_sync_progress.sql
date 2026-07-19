-- Tracks in-progress sync state so the UI can show real progress and resume watching a sync
-- that was kicked off from a page the user has since navigated away from (the sync itself
-- continues server-side regardless - see src/app/api/gmail/sync/route.ts).

alter table email_connections
  add column sync_status text not null default 'idle' check (sync_status in ('idle', 'running', 'error')),
  add column sync_processed int not null default 0,
  add column sync_total int not null default 0,
  add column sync_imported int not null default 0,
  add column sync_duplicates int not null default 0,
  add column sync_skipped int not null default 0,
  add column sync_unmatched_account int not null default 0,
  add column sync_error text;

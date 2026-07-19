-- Vercel caps how many times a request chain can call itself in a row ("508 Loop Detected"),
-- confirmed by running a real sync against a mailbox large enough to need more hops than that
-- cap allows. Persisting the Gmail pageToken to resume from means a "Sync now" click after the
-- chain gets cut off continues exactly where it left off instead of re-scanning from the start.

alter table email_connections
  add column sync_resume_token text;

-- Stores OAuth connections to Gmail mailboxes used to ingest HDFC transaction-alert emails.
-- refresh_token is encrypted at the application layer (see src/lib/crypto/secret-box.ts) before
-- being written here - this table only ever sees ciphertext, never a usable token.

create type email_connection_role as enum ('historical', 'live');

create table email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_address text not null,
  role email_connection_role not null,
  refresh_token text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email_address)
);

create index email_connections_user_id_idx on email_connections (user_id);

create trigger email_connections_set_updated_at before update on email_connections
  for each row execute function set_updated_at();

alter table email_connections enable row level security;

create policy email_connections_owner_all on email_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- User-defined display names for merchants, keyed by the same "core" signature used for
-- similar-transaction grouping (see src/lib/transactions/similar.ts reduceDescription). Editing
-- one transaction's merchant name applies to every transaction sharing that signature, past and
-- future, purely for display - description_raw is never modified.

create table merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index merchant_aliases_user_id_idx on merchant_aliases (user_id);

create trigger merchant_aliases_set_updated_at before update on merchant_aliases
  for each row execute function set_updated_at();

alter table merchant_aliases enable row level security;

create policy merchant_aliases_owner_all on merchant_aliases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

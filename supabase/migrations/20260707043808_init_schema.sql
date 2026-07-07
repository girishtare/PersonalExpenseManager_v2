-- Personal Expense Manager - core schema (phase 1: HDFC only)
-- Tables are owned per-user via auth.uid(); categories/categorization_rules also allow
-- shared "system" rows (user_id is null) seeded in the next migration.

create extension if not exists pgcrypto;

create type account_type as enum ('savings', 'current', 'credit_card');
create type source_format as enum ('pdf', 'csv', 'xlsx');
create type parse_status as enum ('pending', 'processing', 'parsed', 'partially_parsed', 'failed');
create type category_type as enum ('income', 'expense');
create type rule_match_type as enum ('contains', 'starts_with', 'exact', 'regex');
create type txn_direction as enum ('debit', 'credit');

-- ACCOUNTS ------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_code text not null,
  account_type account_type not null,
  display_name text not null,
  last4 text,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on accounts (user_id);

-- STATEMENTS ------------------------------------------------------------------

create table statements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  source_format source_format not null,
  statement_period_start date,
  statement_period_end date,
  parse_status parse_status not null default 'pending',
  parse_error text,
  transactions_imported_count int not null default 0,
  transactions_duplicate_count int not null default 0,
  password_protected boolean not null default false,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index statements_account_id_idx on statements (account_id);
create index statements_user_id_idx on statements (user_id);

-- CATEGORIES ------------------------------------------------------------------
-- user_id null => shipped system category, visible to all users, not owned by anyone

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type category_type not null,
  parent_id uuid references categories(id) on delete set null,
  icon text,
  color text,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, name, type)
);

create index categories_user_id_idx on categories (user_id);

-- CATEGORIZATION RULES ------------------------------------------------------------------
-- user_id null => shipped system rule. direction null => matches either debit or credit.

create table categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  match_type rule_match_type not null default 'contains',
  pattern text not null,
  direction txn_direction,
  priority int not null default 100,
  created_from_override boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categorization_rules_user_id_priority_idx on categorization_rules (user_id, priority);

-- TRANSACTIONS ------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  statement_id uuid references statements(id) on delete set null,
  txn_date date not null,
  value_date date,
  description_raw text not null,
  description_normalized text generated always as (lower(trim(description_raw))) stored,
  amount numeric(14, 2) not null check (amount >= 0),
  direction txn_direction not null,
  category_id uuid not null references categories(id),
  categorization_rule_id uuid references categorization_rules(id) on delete set null,
  is_manual_override boolean not null default false,
  reference_no text,
  -- Deterministic dedupe key so re-uploading a statement with overlapping dates is a no-op.
  -- Must reference base columns only (generated columns can't reference other generated columns).
  dedupe_hash text generated always as (
    encode(
      digest(
        account_id::text || '|' || txn_date::text || '|' || amount::text || '|' ||
        direction::text || '|' || lower(trim(description_raw)) || '|' || coalesce(reference_no, ''),
        'sha256'
      ),
      'hex'
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, dedupe_hash)
);

create index transactions_user_id_txn_date_idx on transactions (user_id, txn_date);
create index transactions_account_id_idx on transactions (account_id);
create index transactions_category_id_idx on transactions (category_id);

-- updated_at TRIGGERS ------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_set_updated_at before update on accounts
  for each row execute function set_updated_at();
create trigger categorization_rules_set_updated_at before update on categorization_rules
  for each row execute function set_updated_at();
create trigger transactions_set_updated_at before update on transactions
  for each row execute function set_updated_at();

-- ROW LEVEL SECURITY ------------------------------------------------------------------

alter table accounts enable row level security;
alter table statements enable row level security;
alter table categories enable row level security;
alter table categorization_rules enable row level security;
alter table transactions enable row level security;

create policy accounts_owner_all on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy statements_owner_all on statements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy transactions_owner_all on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories/rules: everyone can read system rows (user_id is null) plus their own;
-- only the owner can insert/update/delete their own rows. System rows are seeded by
-- migrations (service role) and are not writable through RLS by any app user.
create policy categories_select on categories
  for select using (user_id = auth.uid() or user_id is null);
create policy categories_insert on categories
  for insert with check (user_id = auth.uid());
create policy categories_update on categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_delete on categories
  for delete using (user_id = auth.uid());

create policy categorization_rules_select on categorization_rules
  for select using (user_id = auth.uid() or user_id is null);
create policy categorization_rules_insert on categorization_rules
  for insert with check (user_id = auth.uid());
create policy categorization_rules_update on categorization_rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categorization_rules_delete on categorization_rules
  for delete using (user_id = auth.uid());

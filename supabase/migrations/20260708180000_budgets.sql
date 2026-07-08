-- Per-category monthly budgets, editable from the dashboard's Budget vs Actual card.
-- effective_from allows a budget amount to change over time without losing history - the
-- "current" budget for a category is the row with the latest effective_from <= the month being
-- viewed (resolved in application code; personal-scale data, no need for a SQL view per the
-- "keep aggregation in the Server Component" note).

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  monthly_amount numeric(14, 2) not null check (monthly_amount >= 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, effective_from)
);

create index budgets_user_id_idx on budgets (user_id);
create index budgets_category_id_idx on budgets (category_id);

create trigger budgets_set_updated_at before update on budgets
  for each row execute function set_updated_at();

alter table budgets enable row level security;

create policy budgets_owner_all on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

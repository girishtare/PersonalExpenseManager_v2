-- Daily Claude-generated financial advisory (investment/savings + spending-reduction tips) -
-- one row per user, overwritten each time the daily cron job (see /api/insights/generate) runs.
-- Written only by the service-role cron job, which bypasses RLS - the owner_read policy below is
-- the only access authenticated/anon roles get, and it's read-only by omission (no write policy).

create table financial_advisory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  model text not null,
  investment_tips jsonb not null default '[]'::jsonb,
  spending_tips jsonb not null default '[]'::jsonb,
  unique (user_id)
);

alter table financial_advisory enable row level security;

create policy financial_advisory_owner_read on financial_advisory
  for select using (user_id = auth.uid());

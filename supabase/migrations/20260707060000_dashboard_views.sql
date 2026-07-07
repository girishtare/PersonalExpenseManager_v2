-- Dashboard aggregation views. `security_invoker = true` is required (PG15+) so these views
-- enforce RLS as the querying user - without it, views run with the view owner's privileges
-- and would silently bypass the transactions table's RLS policy.

create view v_category_totals
with (security_invoker = true) as
select
  t.user_id,
  c.id as category_id,
  c.name as category_name,
  c.type as category_type,
  date_trunc('month', t.txn_date)::date as month,
  sum(t.amount) as total_amount,
  count(*) as txn_count
from transactions t
join categories c on c.id = t.category_id
group by t.user_id, c.id, c.name, c.type, date_trunc('month', t.txn_date);

create view v_monthly_totals
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.txn_date)::date as month,
  t.direction,
  sum(t.amount) as total_amount
from transactions t
group by t.user_id, date_trunc('month', t.txn_date), t.direction;

grant select on v_category_totals to authenticated;
grant select on v_monthly_totals to authenticated;

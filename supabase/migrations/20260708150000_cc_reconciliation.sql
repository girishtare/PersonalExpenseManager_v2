-- Support for credit card statement reconciliation.

-- Statement-level totals, captured by the parser when available (nullable - not every
-- format/parse attempt will find them; see buildCreditCardStatementFromRows /
-- extractCreditCardStatementTotals). total_amount_due is the statement's own printed "Total
-- Amount Due" (includes any carried-over balance from prior months); opening_balance is the
-- balance carried in from the previous statement. The reconciliation view checks
-- opening_balance + sum(this statement's transactions) ~= total_amount_due - comparing
-- total_amount_due directly against the transaction sum would always mismatch by the carried
-- balance, since Total Amount Due is not scoped to just this period's activity.
alter table statements add column total_amount_due numeric(14, 2);
alter table statements add column opening_balance numeric(14, 2);

-- Credit card refund/fee-waiver credits (e.g. "SURCHARGE WAIVER") are not income - they reduce
-- a prior expense, not add new money. They're kept separate from the shared "Refunds &
-- Reimbursements" (income-type) category used by bank-side refund rules, since categorization
-- rules aren't account-type-scoped and changing that shared category's type would also affect
-- bank-account refund behaviour, which is out of scope here.
insert into categories (name, type, is_system, sort_order, txn_type)
values ('Card Refunds & Waivers', 'expense', true, 120, 'expense');

with c as (
  select id from categories where user_id is null and name = 'Card Refunds & Waivers'
)
insert into categorization_rules (category_id, match_type, pattern, direction, priority)
select c.id, 'contains', 'SURCHARGE WAIVER', 'credit', 15 from c;

-- Transaction typing, derived from category (with a per-transaction override for exceptions).
-- Distinct from categories.type (income/expense - basic UI grouping) - this is the
-- classification dashboard aggregates should use instead of raw debit/credit direction, which
-- currently double-counts internal transfers and investments as real expense/income.

create type txn_type as enum ('expense', 'income', 'transfer', 'investment');

alter table categories add column txn_type txn_type not null default 'expense';

-- "CC Payment" is the credit-card-side mirror of "CC Bill Payment" (bank account debit ->
-- credit card account credit, same movement - confirmed by matching descriptions/accounts in
-- the live data). "Transfers Out/In (Own Accounts)" are NEFT/IMPS/RTGS/UPI self-transfers
-- between the user's own accounts (see their categorization_rules), not real income/expense.
-- "Transfers Out (Others Accounts)" is left as expense - that's money leaving to someone else.
update categories set txn_type = 'transfer' where name in (
  'CC Bill Payment',
  'CC Payment',
  'Transfers Out (Own Accounts)',
  'Transfers In (Own Accounts)'
);

-- Stocks & ETFs follows the same logic as Mutual Funds/Emergency Fund - money moved into an
-- investment, not spent.
update categories set txn_type = 'investment' where name in (
  'Mutual Funds',
  'Emergency Fund',
  'Stocks & ETFs'
);

-- Remaining income-type categories (Salary, Interest Income, Refunds & Reimbursements,
-- Other Income, Dividend Income, ...) stay income. The txn_type = 'expense' guard skips rows
-- already reclassified to transfer above (e.g. CC Payment, Transfers In).
update categories set txn_type = 'income' where type = 'income' and txn_type = 'expense';

-- Every other expense-type category keeps the column default ('expense').

alter table transactions add column txn_type_override txn_type;

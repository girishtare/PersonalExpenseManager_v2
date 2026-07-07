-- Seed system categories (user_id null) and a first-pass keyword rule set.
-- These are a starting point tuned for common Indian bank narration text -
-- expect to tune priorities/patterns once real HDFC statements are imported.

insert into categories (name, type, is_system, sort_order) values
  ('Salary', 'income', true, 10),
  ('Funds Transfer In', 'income', true, 20),
  ('Interest', 'income', true, 30),
  ('Refunds & Reversals', 'income', true, 40),
  ('Other Income', 'income', true, 50),
  ('Groceries', 'expense', true, 10),
  ('Dining & Food Delivery', 'expense', true, 20),
  ('Transport & Fuel', 'expense', true, 30),
  ('Shopping', 'expense', true, 40),
  ('Bills & Utilities', 'expense', true, 50),
  ('Entertainment & Subscriptions', 'expense', true, 60),
  ('Healthcare', 'expense', true, 70),
  ('EMI & Loan Payments', 'expense', true, 80),
  ('Cash Withdrawal', 'expense', true, 90),
  ('Transfers Out', 'expense', true, 100),
  ('Fees & Charges', 'expense', true, 110),
  ('Uncategorized', 'expense', true, 999);

-- Seed rules by looking up each category's id by name (user_id is null = system category).
-- priority: lower number wins when multiple rules match the same transaction.
with c as (
  select id, name from categories where user_id is null
)
insert into categorization_rules (category_id, match_type, pattern, direction, priority)
select c.id, v.match_type::rule_match_type, v.pattern, v.direction::txn_direction, v.priority
from (values
  -- Income (credit-only)
  ('Salary',                       'contains', 'SALARY',      'credit', 10),
  ('Interest',                     'contains', 'INTEREST',    'credit', 20),
  ('Interest',                     'contains', 'INT.PD',      'credit', 20),
  ('Refunds & Reversals',          'contains', 'REFUND',      'credit', 20),
  ('Refunds & Reversals',          'contains', 'REVERSAL',    'credit', 20),
  ('Refunds & Reversals',          'contains', 'CASHBACK',    'credit', 30),
  ('Funds Transfer In',            'contains', 'NEFT',        'credit', 50),
  ('Funds Transfer In',            'contains', 'IMPS',        'credit', 50),
  ('Funds Transfer In',            'contains', 'RTGS',        'credit', 50),
  ('Funds Transfer In',            'contains', 'UPI',         'credit', 60),
  -- Expense (debit-only)
  ('Dining & Food Delivery',       'contains', 'SWIGGY',      'debit', 10),
  ('Dining & Food Delivery',       'contains', 'ZOMATO',      'debit', 10),
  ('Groceries',                    'contains', 'BIGBASKET',   'debit', 10),
  ('Groceries',                    'contains', 'BLINKIT',     'debit', 10),
  ('Groceries',                    'contains', 'ZEPTO',       'debit', 10),
  ('Groceries',                    'contains', 'DMART',       'debit', 10),
  ('Shopping',                     'contains', 'AMAZON',      'debit', 10),
  ('Shopping',                     'contains', 'FLIPKART',    'debit', 10),
  ('Shopping',                     'contains', 'MYNTRA',      'debit', 10),
  ('Transport & Fuel',             'contains', 'UBER',        'debit', 10),
  ('Transport & Fuel',             'contains', 'OLA',         'debit', 10),
  ('Transport & Fuel',             'contains', 'IRCTC',       'debit', 15),
  ('Transport & Fuel',             'contains', 'PETROL',      'debit', 15),
  ('Transport & Fuel',             'contains', 'FUEL',        'debit', 15),
  ('Entertainment & Subscriptions','contains', 'NETFLIX',     'debit', 10),
  ('Entertainment & Subscriptions','contains', 'SPOTIFY',     'debit', 10),
  ('Entertainment & Subscriptions','contains', 'PRIME VIDEO', 'debit', 10),
  ('Entertainment & Subscriptions','contains', 'HOTSTAR',     'debit', 10),
  ('EMI & Loan Payments',          'contains', 'EMI',         'debit', 10),
  ('EMI & Loan Payments',          'contains', 'LOAN',        'debit', 15),
  ('Healthcare',                   'contains', 'HOSPITAL',    'debit', 15),
  ('Healthcare',                   'contains', 'PHARMACY',    'debit', 15),
  ('Healthcare',                   'contains', 'APOLLO',      'debit', 15),
  ('Bills & Utilities',            'contains', 'ELECTRICITY', 'debit', 15),
  ('Bills & Utilities',            'contains', 'BROADBAND',   'debit', 15),
  ('Bills & Utilities',            'contains', 'JIO',         'debit', 20),
  ('Bills & Utilities',            'contains', 'AIRTEL',      'debit', 20),
  ('Bills & Utilities',            'contains', 'RECHARGE',    'debit', 20),
  ('Cash Withdrawal',              'contains', 'ATM',         'debit', 20),
  ('Cash Withdrawal',              'contains', 'CASH WDL',    'debit', 20),
  ('Fees & Charges',               'contains', 'CHARGES',     'debit', 30),
  ('Fees & Charges',               'contains', 'FEE',         'debit', 40),
  ('Transfers Out',                'contains', 'NEFT',        'debit', 60),
  ('Transfers Out',                'contains', 'IMPS',        'debit', 60),
  ('Transfers Out',                'contains', 'RTGS',        'debit', 60),
  ('Transfers Out',                'contains', 'UPI',         'debit', 70)
) as v(category_name, match_type, pattern, direction, priority)
join c on c.name = v.category_name;

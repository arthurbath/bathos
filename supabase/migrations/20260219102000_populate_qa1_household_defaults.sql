-- Populate realistic baseline Budget data for the QA household(s) containing art+qa1@bath.garden.
-- This migration is idempotent and can be safely re-run.

WITH target_households AS (
  SELECT DISTINCT hm.household_id
  FROM public.budget_household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE lower(u.email) = 'art+qa1@bath.garden'
),
category_templates AS (
  SELECT *
  FROM (
    VALUES
      ('Housing', NULL::text),
      ('Utilities', NULL::text),
      ('Groceries', NULL::text),
      ('Transportation', NULL::text),
      ('Insurance', NULL::text),
      ('Healthcare', NULL::text),
      ('Dining', NULL::text),
      ('Household', NULL::text),
      ('Subscriptions', NULL::text),
      ('Debt', NULL::text),
      ('Savings', NULL::text),
      ('Pets', NULL::text),
      ('Entertainment', NULL::text)
  ) AS t(name, color)
)
INSERT INTO public.budget_categories (household_id, name, color)
SELECT th.household_id, ct.name, ct.color
FROM target_households th
CROSS JOIN category_templates ct
WHERE NOT EXISTS (
  SELECT 1
  FROM public.budget_categories c
  WHERE c.household_id = th.household_id
    AND lower(c.name) = lower(ct.name)
);

WITH target_households AS (
  SELECT DISTINCT hm.household_id
  FROM public.budget_household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE lower(u.email) = 'art+qa1@bath.garden'
),
budget_templates AS (
  SELECT *
  FROM (
    VALUES
      ('Fixed Essentials', NULL::text),
      ('Flexible Essentials', NULL::text),
      ('Lifestyle', NULL::text)
  ) AS t(name, color)
)
INSERT INTO public.budget_budgets (household_id, name, color)
SELECT th.household_id, bt.name, bt.color
FROM target_households th
CROSS JOIN budget_templates bt
WHERE NOT EXISTS (
  SELECT 1
  FROM public.budget_budgets b
  WHERE b.household_id = th.household_id
    AND lower(b.name) = lower(bt.name)
);

WITH target_households AS (
  SELECT DISTINCT hm.household_id
  FROM public.budget_household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE lower(u.email) = 'art+qa1@bath.garden'
),
linked_account_templates AS (
  SELECT *
  FROM (
    VALUES
      ('Joint Checking', 'X', NULL::text),
      ('Joint Credit Card', 'X', NULL::text),
      ('Partner X Checking', 'X', NULL::text),
      ('Partner X Credit Card', 'X', NULL::text),
      ('Partner Y Checking', 'Y', NULL::text),
      ('Partner Y Credit Card', 'Y', NULL::text)
  ) AS t(name, owner_partner, color)
),
accounts_to_insert AS (
  SELECT th.household_id, lat.name, lat.owner_partner, lat.color
  FROM target_households th
  JOIN linked_account_templates lat
    ON lat.owner_partner = 'X'
    OR EXISTS (
      SELECT 1
      FROM public.budget_household_members hm
      WHERE hm.household_id = th.household_id
        AND hm.partner_label = lat.owner_partner
    )
)
INSERT INTO public.budget_linked_accounts (household_id, name, owner_partner, color)
SELECT ati.household_id, ati.name, ati.owner_partner, ati.color
FROM accounts_to_insert ati
WHERE NOT EXISTS (
  SELECT 1
  FROM public.budget_linked_accounts la
  WHERE la.household_id = ati.household_id
    AND lower(la.name) = lower(ati.name)
);

WITH target_households AS (
  SELECT DISTINCT hm.household_id
  FROM public.budget_household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE lower(u.email) = 'art+qa1@bath.garden'
),
income_templates AS (
  SELECT *
  FROM (
    VALUES
      ('X', 'Primary Salary', 3200::numeric, 'twice_monthly'::text, NULL::integer),
      ('X', 'Annual Bonus', 4800::numeric, 'annual'::text, NULL::integer),
      ('Y', 'Primary Salary', 2700::numeric, 'twice_monthly'::text, NULL::integer),
      ('Y', 'Annual Bonus', 3600::numeric, 'annual'::text, NULL::integer)
  ) AS t(partner_label, name, amount, frequency_type, frequency_param)
),
incomes_to_insert AS (
  SELECT th.household_id, it.partner_label, it.name, it.amount, it.frequency_type, it.frequency_param
  FROM target_households th
  JOIN income_templates it
    ON EXISTS (
      SELECT 1
      FROM public.budget_household_members hm
      WHERE hm.household_id = th.household_id
        AND hm.partner_label = it.partner_label
    )
)
INSERT INTO public.budget_income_streams (
  household_id,
  partner_label,
  name,
  amount,
  frequency_type,
  frequency_param
)
SELECT iti.household_id, iti.partner_label, iti.name, iti.amount, iti.frequency_type, iti.frequency_param
FROM incomes_to_insert iti
WHERE NOT EXISTS (
  SELECT 1
  FROM public.budget_income_streams i
  WHERE i.household_id = iti.household_id
    AND i.partner_label = iti.partner_label
    AND lower(i.name) = lower(iti.name)
);

WITH target_households AS (
  SELECT DISTINCT hm.household_id
  FROM public.budget_household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE lower(u.email) = 'art+qa1@bath.garden'
),
expense_templates AS (
  SELECT *
  FROM (
    VALUES
      ('Rent', 'Housing', 'Fixed Essentials', 'Joint Checking', 2200::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Electricity', 'Utilities', 'Fixed Essentials', 'Joint Checking', 145::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Water and Sewer', 'Utilities', 'Fixed Essentials', 'Joint Checking', 70::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Internet', 'Utilities', 'Fixed Essentials', 'Joint Credit Card', 75::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Mobile Plans', 'Utilities', 'Fixed Essentials', 'Partner Y Credit Card', 120::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Groceries', 'Groceries', 'Flexible Essentials', 'Joint Credit Card', 190::numeric, true, 'weekly'::text, NULL::integer, 50),
      ('Household Supplies', 'Household', 'Flexible Essentials', 'Joint Credit Card', 65::numeric, true, 'monthly'::text, NULL::integer, 50),
      ('Gas and Transit', 'Transportation', 'Flexible Essentials', 'Partner X Credit Card', 85::numeric, true, 'weekly'::text, NULL::integer, 60),
      ('Parking and Tolls', 'Transportation', 'Flexible Essentials', 'Partner X Credit Card', 40::numeric, true, 'monthly'::text, NULL::integer, 60),
      ('Car Payment', 'Debt', 'Fixed Essentials', 'Partner X Checking', 360::numeric, false, 'monthly'::text, NULL::integer, 70),
      ('Car Insurance', 'Insurance', 'Fixed Essentials', 'Partner X Credit Card', 165::numeric, false, 'monthly'::text, NULL::integer, 70),
      ('Renter Insurance', 'Insurance', 'Fixed Essentials', 'Joint Credit Card', 22::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Health Insurance Premiums', 'Healthcare', 'Fixed Essentials', 'Partner Y Checking', 420::numeric, false, 'monthly'::text, NULL::integer, 45),
      ('Prescriptions and Copays', 'Healthcare', 'Flexible Essentials', 'Partner Y Credit Card', 65::numeric, true, 'monthly'::text, NULL::integer, 45),
      ('Gym Memberships', 'Healthcare', 'Lifestyle', 'Partner Y Credit Card', 92::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Streaming Services', 'Subscriptions', 'Lifestyle', 'Partner Y Credit Card', 28::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Cloud Storage', 'Subscriptions', 'Lifestyle', 'Partner X Credit Card', 10::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Dining Out', 'Dining', 'Lifestyle', 'Joint Credit Card', 95::numeric, true, 'weekly'::text, NULL::integer, 50),
      ('Weekend Activities', 'Entertainment', 'Lifestyle', 'Joint Credit Card', 80::numeric, true, 'weekly'::text, NULL::integer, 50),
      ('Pet Food and Vet', 'Pets', 'Flexible Essentials', 'Joint Credit Card', 110::numeric, true, 'monthly'::text, NULL::integer, 50),
      ('Home Maintenance', 'Household', 'Flexible Essentials', 'Joint Checking', 120::numeric, true, 'monthly'::text, NULL::integer, 50),
      ('Toiletries and Personal Care', 'Household', 'Flexible Essentials', 'Joint Credit Card', 45::numeric, true, 'monthly'::text, NULL::integer, 50),
      ('Student Loan', 'Debt', 'Fixed Essentials', 'Partner Y Checking', 280::numeric, false, 'monthly'::text, NULL::integer, 30),
      ('Emergency Fund Contribution', 'Savings', 'Fixed Essentials', 'Joint Checking', 300::numeric, false, 'monthly'::text, NULL::integer, 50),
      ('Gifts and Holidays', 'Entertainment', 'Lifestyle', 'Joint Credit Card', 180::numeric, true, 'k_times_annually'::text, 6, 50)
  ) AS t(
    name,
    category_name,
    budget_name,
    linked_account_name,
    amount,
    is_estimate,
    frequency_type,
    frequency_param,
    benefit_x
  )
),
category_lookup AS (
  SELECT household_id, lower(name) AS name_key, min(id::text)::uuid AS id
  FROM public.budget_categories
  GROUP BY household_id, lower(name)
),
budget_lookup AS (
  SELECT household_id, lower(name) AS name_key, min(id::text)::uuid AS id
  FROM public.budget_budgets
  GROUP BY household_id, lower(name)
),
linked_account_lookup AS (
  SELECT household_id, lower(name) AS name_key, min(id::text)::uuid AS id
  FROM public.budget_linked_accounts
  GROUP BY household_id, lower(name)
)
INSERT INTO public.budget_expenses (
  household_id,
  name,
  category_id,
  budget_id,
  linked_account_id,
  amount,
  is_estimate,
  frequency_type,
  frequency_param,
  benefit_x
)
SELECT
  th.household_id,
  et.name,
  cl.id,
  bl.id,
  lal.id,
  et.amount,
  et.is_estimate,
  et.frequency_type,
  et.frequency_param,
  et.benefit_x
FROM target_households th
JOIN expense_templates et ON TRUE
JOIN category_lookup cl
  ON cl.household_id = th.household_id
 AND cl.name_key = lower(et.category_name)
JOIN budget_lookup bl
  ON bl.household_id = th.household_id
 AND bl.name_key = lower(et.budget_name)
JOIN linked_account_lookup lal
  ON lal.household_id = th.household_id
 AND lal.name_key = lower(et.linked_account_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.budget_expenses e
  WHERE e.household_id = th.household_id
    AND lower(e.name) = lower(et.name)
);

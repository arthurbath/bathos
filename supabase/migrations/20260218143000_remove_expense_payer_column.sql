-- Payer is derived from budget_linked_accounts.owner_partner via expenses.linked_account_id.
-- Remove redundant per-expense payer persistence to avoid stale mismatches.
ALTER TABLE public.budget_expenses
DROP COLUMN IF EXISTS payer;


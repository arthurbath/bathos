
ALTER TABLE public.expenses
  ADD COLUMN is_estimate boolean NOT NULL DEFAULT false,
  ADD COLUMN budget text,
  ADD COLUMN linked_account text;

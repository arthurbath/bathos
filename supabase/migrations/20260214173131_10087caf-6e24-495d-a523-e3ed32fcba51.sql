
-- Budgets managed list
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;

CREATE POLICY "Members can view budgets" ON public.budgets FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert budgets" ON public.budgets FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update budgets" ON public.budgets FOR UPDATE USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete budgets" ON public.budgets FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Linked accounts managed list
CREATE TABLE public.linked_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linked_accounts TO authenticated;

CREATE POLICY "Members can view linked_accounts" ON public.linked_accounts FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert linked_accounts" ON public.linked_accounts FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update linked_accounts" ON public.linked_accounts FOR UPDATE USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete linked_accounts" ON public.linked_accounts FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Convert expenses.budget from free text to FK reference
ALTER TABLE public.expenses
  ADD COLUMN budget_id uuid REFERENCES public.budgets(id),
  ADD COLUMN linked_account_id uuid REFERENCES public.linked_accounts(id);

-- Drop old text columns
ALTER TABLE public.expenses DROP COLUMN budget;
ALTER TABLE public.expenses DROP COLUMN linked_account;

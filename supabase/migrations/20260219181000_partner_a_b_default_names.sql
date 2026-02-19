-- Move default household partner names from X/Y wording to A/B wording.
-- Also migrate existing households that still have the legacy default names.

ALTER TABLE public.budget_households
  ALTER COLUMN partner_x_name SET DEFAULT 'Partner A',
  ALTER COLUMN partner_y_name SET DEFAULT 'Partner B';

UPDATE public.budget_households
SET partner_x_name = 'Partner A'
WHERE partner_x_name = 'Partner X';

UPDATE public.budget_households
SET partner_y_name = 'Partner B'
WHERE partner_y_name = 'Partner Y';

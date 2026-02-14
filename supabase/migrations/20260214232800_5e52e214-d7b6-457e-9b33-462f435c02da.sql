
-- Add color column to categories, budgets, linked_accounts
ALTER TABLE public.categories ADD COLUMN color text;
ALTER TABLE public.budgets ADD COLUMN color text;
ALTER TABLE public.linked_accounts ADD COLUMN color text;

-- Add partner colors to households
ALTER TABLE public.households ADD COLUMN partner_x_color text;
ALTER TABLE public.households ADD COLUMN partner_y_color text;


-- Create a secure function to look up household by invite code
-- Returns only the household ID, nothing else
CREATE OR REPLACE FUNCTION public.lookup_household_by_invite_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.budget_households WHERE invite_code = _code LIMIT 1;
$$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can find household by invite code" ON public.budget_households;

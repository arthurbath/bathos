CREATE OR REPLACE FUNCTION public.lookup_household_by_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _code IS NULL OR _code !~ '^[a-f0-9]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN (SELECT id FROM public.budget_households WHERE invite_code = _code LIMIT 1);
END;
$$;
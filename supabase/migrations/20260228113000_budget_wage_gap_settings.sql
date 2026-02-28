ALTER TABLE public.budget_households
ADD COLUMN IF NOT EXISTS wage_gap_adjustment_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS partner_x_wage_cents_per_dollar numeric(5,2),
ADD COLUMN IF NOT EXISTS partner_y_wage_cents_per_dollar numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budget_households_partner_x_wage_cents_check'
  ) THEN
    ALTER TABLE public.budget_households
      ADD CONSTRAINT budget_households_partner_x_wage_cents_check
      CHECK (
        partner_x_wage_cents_per_dollar IS NULL
        OR (partner_x_wage_cents_per_dollar > 0 AND partner_x_wage_cents_per_dollar <= 100)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budget_households_partner_y_wage_cents_check'
  ) THEN
    ALTER TABLE public.budget_households
      ADD CONSTRAINT budget_households_partner_y_wage_cents_check
      CHECK (
        partner_y_wage_cents_per_dollar IS NULL
        OR (partner_y_wage_cents_per_dollar > 0 AND partner_y_wage_cents_per_dollar <= 100)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.budget_update_partner_settings(
  _household_id uuid,
  _partner_x_name text,
  _partner_y_name text,
  _wage_gap_adjustment_enabled boolean,
  _partner_x_wage_cents_per_dollar numeric,
  _partner_y_wage_cents_per_dollar numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_household public.budget_households%ROWTYPE;
  v_partner_x_name text := NULLIF(trim(_partner_x_name), '');
  v_partner_y_name text := NULLIF(trim(_partner_y_name), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(v_user_id, _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_partner_x_name IS NULL OR v_partner_y_name IS NULL THEN
    RAISE EXCEPTION 'Partner names cannot be empty';
  END IF;

  IF _partner_x_wage_cents_per_dollar IS NOT NULL
     AND (_partner_x_wage_cents_per_dollar <= 0 OR _partner_x_wage_cents_per_dollar > 100) THEN
    RAISE EXCEPTION 'Partner X wage-gap value must be greater than 0 and at most 100';
  END IF;

  IF _partner_y_wage_cents_per_dollar IS NOT NULL
     AND (_partner_y_wage_cents_per_dollar <= 0 OR _partner_y_wage_cents_per_dollar > 100) THEN
    RAISE EXCEPTION 'Partner Y wage-gap value must be greater than 0 and at most 100';
  END IF;

  UPDATE public.budget_households
  SET partner_x_name = v_partner_x_name,
      partner_y_name = v_partner_y_name,
      wage_gap_adjustment_enabled = COALESCE(_wage_gap_adjustment_enabled, false),
      partner_x_wage_cents_per_dollar = _partner_x_wage_cents_per_dollar,
      partner_y_wage_cents_per_dollar = _partner_y_wage_cents_per_dollar
  WHERE id = _household_id
  RETURNING * INTO v_household;

  SELECT NULLIF(trim(display_name), '')
    INTO v_display_name
  FROM public.bathos_profiles
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'householdName', v_household.name,
    'inviteCode', v_household.invite_code,
    'partnerX', v_household.partner_x_name,
    'partnerY', v_household.partner_y_name,
    'wageGapAdjustmentEnabled', v_household.wage_gap_adjustment_enabled,
    'partnerXWageCentsPerDollar', v_household.partner_x_wage_cents_per_dollar,
    'partnerYWageCentsPerDollar', v_household.partner_y_wage_cents_per_dollar,
    'displayName', coalesce(v_display_name, 'You')
  );
END;
$$;

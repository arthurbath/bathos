-- Performance and atomic-action migration for no-optimistic CRUD UX.
-- Adds budget indexes and RPCs to reduce request count and round-trip latency.

-- ---------------------------------------------------------------------------
-- Indexes for budget access patterns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS budget_household_members_user_id_idx
  ON public.budget_household_members(user_id);

CREATE INDEX IF NOT EXISTS budget_categories_household_name_idx
  ON public.budget_categories(household_id, name);

CREATE INDEX IF NOT EXISTS budget_linked_accounts_household_name_idx
  ON public.budget_linked_accounts(household_id, name);

CREATE INDEX IF NOT EXISTS budget_budgets_household_name_idx
  ON public.budget_budgets(household_id, name);

CREATE INDEX IF NOT EXISTS budget_income_streams_household_created_at_idx
  ON public.budget_income_streams(household_id, created_at);

CREATE INDEX IF NOT EXISTS budget_expenses_household_created_at_idx
  ON public.budget_expenses(household_id, created_at);

CREATE INDEX IF NOT EXISTS budget_expenses_household_category_id_idx
  ON public.budget_expenses(household_id, category_id);

CREATE INDEX IF NOT EXISTS budget_expenses_household_linked_account_id_idx
  ON public.budget_expenses(household_id, linked_account_id);

CREATE INDEX IF NOT EXISTS budget_restore_points_household_created_at_desc_idx
  ON public.budget_restore_points(household_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Atomic RPCs for budget actions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_reassign_category_and_delete(
  _household_id uuid,
  _old_category_id uuid,
  _new_category_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(auth.uid(), _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_categories
    WHERE id = _old_category_id
      AND household_id = _household_id
  ) THEN
    RAISE EXCEPTION 'Category not found in household';
  END IF;

  IF _new_category_id IS NOT NULL THEN
    IF _new_category_id = _old_category_id THEN
      RAISE EXCEPTION 'Replacement category must be different from the deleted category';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.budget_categories
      WHERE id = _new_category_id
        AND household_id = _household_id
    ) THEN
      RAISE EXCEPTION 'Replacement category not found in household';
    END IF;
  END IF;

  UPDATE public.budget_expenses
  SET category_id = _new_category_id
  WHERE household_id = _household_id
    AND category_id = _old_category_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  DELETE FROM public.budget_categories
  WHERE id = _old_category_id
    AND household_id = _household_id;

  RETURN jsonb_build_object(
    'householdId', _household_id,
    'deletedCategoryId', _old_category_id,
    'replacementCategoryId', _new_category_id,
    'updatedExpenseCount', v_updated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_reassign_linked_account_and_delete(
  _household_id uuid,
  _old_linked_account_id uuid,
  _new_linked_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(auth.uid(), _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_linked_accounts
    WHERE id = _old_linked_account_id
      AND household_id = _household_id
  ) THEN
    RAISE EXCEPTION 'Payment method not found in household';
  END IF;

  IF _new_linked_account_id IS NOT NULL THEN
    IF _new_linked_account_id = _old_linked_account_id THEN
      RAISE EXCEPTION 'Replacement payment method must be different from the deleted payment method';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.budget_linked_accounts
      WHERE id = _new_linked_account_id
        AND household_id = _household_id
    ) THEN
      RAISE EXCEPTION 'Replacement payment method not found in household';
    END IF;
  END IF;

  UPDATE public.budget_expenses
  SET linked_account_id = _new_linked_account_id
  WHERE household_id = _household_id
    AND linked_account_id = _old_linked_account_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  DELETE FROM public.budget_linked_accounts
  WHERE id = _old_linked_account_id
    AND household_id = _household_id;

  RETURN jsonb_build_object(
    'householdId', _household_id,
    'deletedLinkedAccountId', _old_linked_account_id,
    'replacementLinkedAccountId', _new_linked_account_id,
    'updatedExpenseCount', v_updated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_create_household_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_household public.budget_households%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_household_members
    WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You already belong to a budget household';
  END IF;

  SELECT NULLIF(trim(display_name), '')
    INTO v_display_name
  FROM public.bathos_profiles
  WHERE id = v_user_id;

  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'Please set your display name before creating a household';
  END IF;

  INSERT INTO public.budget_households (name, partner_x_name, partner_y_name)
  VALUES ('My Household', v_display_name, 'Partner B')
  RETURNING * INTO v_household;

  INSERT INTO public.budget_household_members (household_id, user_id, partner_label)
  VALUES (v_household.id, v_user_id, 'X');

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'householdName', v_household.name,
    'inviteCode', v_household.invite_code,
    'partnerX', v_household.partner_x_name,
    'partnerY', v_household.partner_y_name,
    'displayName', v_display_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_join_household_for_current_user(_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_normalized_code text;
  v_household_id uuid;
  v_existing_household_id uuid;
  v_household public.budget_households%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT NULLIF(trim(display_name), '')
    INTO v_display_name
  FROM public.bathos_profiles
  WHERE id = v_user_id;

  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'Please set your display name before joining a household';
  END IF;

  v_normalized_code := lower(trim(coalesce(_invite_code, '')));

  IF v_normalized_code = '' THEN
    RAISE EXCEPTION 'Invite code is required';
  END IF;

  v_household_id := public.lookup_household_by_invite_code(v_normalized_code);

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT household_id
    INTO v_existing_household_id
  FROM public.budget_household_members
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_household_id IS NOT NULL THEN
    IF v_existing_household_id = v_household_id THEN
      RAISE EXCEPTION 'You are already a member of this household';
    END IF;
    RAISE EXCEPTION 'You already belong to a different budget household';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_household_members
    WHERE household_id = v_household_id
      AND partner_label = 'Y'
  ) THEN
    RAISE EXCEPTION 'This household already has a second partner';
  END IF;

  INSERT INTO public.budget_household_members (household_id, user_id, partner_label)
  VALUES (v_household_id, v_user_id, 'Y');

  UPDATE public.budget_households
  SET partner_y_name = v_display_name
  WHERE id = v_household_id
    AND partner_y_name IN ('Partner B', 'Partner Y');

  SELECT *
    INTO v_household
  FROM public.budget_households
  WHERE id = v_household_id;

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'householdName', v_household.name,
    'inviteCode', v_household.invite_code,
    'partnerX', v_household.partner_x_name,
    'partnerY', v_household.partner_y_name,
    'displayName', v_display_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_update_partner_names(
  _household_id uuid,
  _partner_x_name text,
  _partner_y_name text
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

  UPDATE public.budget_households
  SET partner_x_name = v_partner_x_name,
      partner_y_name = v_partner_y_name
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
    'displayName', coalesce(v_display_name, 'You')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_restore_household_snapshot(
  _household_id uuid,
  _snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_categories jsonb := COALESCE(_snapshot->'categories', '[]'::jsonb);
  v_linked_accounts jsonb := COALESCE(_snapshot->'linkedAccounts', '[]'::jsonb);
  v_incomes jsonb := COALESCE(_snapshot->'incomes', '[]'::jsonb);
  v_expenses jsonb := COALESCE(_snapshot->'expenses', '[]'::jsonb);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(auth.uid(), _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF jsonb_typeof(v_categories) <> 'array'
    OR jsonb_typeof(v_linked_accounts) <> 'array'
    OR jsonb_typeof(v_incomes) <> 'array'
    OR jsonb_typeof(v_expenses) <> 'array' THEN
    RAISE EXCEPTION 'Snapshot payload is invalid';
  END IF;

  DELETE FROM public.budget_expenses WHERE household_id = _household_id;
  DELETE FROM public.budget_income_streams WHERE household_id = _household_id;
  DELETE FROM public.budget_linked_accounts WHERE household_id = _household_id;
  DELETE FROM public.budget_categories WHERE household_id = _household_id;

  IF jsonb_array_length(v_categories) > 0 THEN
    INSERT INTO public.budget_categories (id, household_id, name, color)
    SELECT COALESCE(x.id, gen_random_uuid()), _household_id, COALESCE(x.name, ''), x.color
    FROM jsonb_to_recordset(v_categories) AS x(id uuid, name text, color text);
  END IF;

  IF jsonb_array_length(v_linked_accounts) > 0 THEN
    INSERT INTO public.budget_linked_accounts (id, household_id, name, owner_partner, color)
    SELECT
      COALESCE(x.id, gen_random_uuid()),
      _household_id,
      COALESCE(x.name, ''),
      CASE WHEN x.owner_partner IN ('X', 'Y') THEN x.owner_partner ELSE 'X' END,
      x.color
    FROM jsonb_to_recordset(v_linked_accounts) AS x(id uuid, name text, owner_partner text, color text);
  END IF;

  IF jsonb_array_length(v_incomes) > 0 THEN
    INSERT INTO public.budget_income_streams (
      id,
      household_id,
      name,
      amount,
      frequency_type,
      frequency_param,
      partner_label
    )
    SELECT
      COALESCE(x.id, gen_random_uuid()),
      _household_id,
      COALESCE(x.name, ''),
      COALESCE(x.amount, 0),
      COALESCE(x.frequency_type, 'monthly'),
      x.frequency_param,
      CASE WHEN x.partner_label IN ('X', 'Y') THEN x.partner_label ELSE 'X' END
    FROM jsonb_to_recordset(v_incomes) AS x(
      id uuid,
      name text,
      amount numeric,
      frequency_type text,
      frequency_param integer,
      partner_label text
    );
  END IF;

  IF jsonb_array_length(v_expenses) > 0 THEN
    INSERT INTO public.budget_expenses (
      id,
      household_id,
      name,
      amount,
      frequency_type,
      frequency_param,
      benefit_x,
      category_id,
      linked_account_id,
      budget_id,
      is_estimate
    )
    SELECT
      COALESCE(x.id, gen_random_uuid()),
      _household_id,
      COALESCE(x.name, ''),
      COALESCE(x.amount, 0),
      COALESCE(x.frequency_type, 'monthly'),
      x.frequency_param,
      COALESCE(x.benefit_x, 50),
      CASE
        WHEN x.category_id IS NULL THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.budget_categories c
          WHERE c.id = x.category_id
            AND c.household_id = _household_id
        ) THEN x.category_id
        ELSE NULL
      END,
      CASE
        WHEN x.linked_account_id IS NULL THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.budget_linked_accounts la
          WHERE la.id = x.linked_account_id
            AND la.household_id = _household_id
        ) THEN x.linked_account_id
        ELSE NULL
      END,
      CASE
        WHEN x.budget_id IS NULL THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.budget_budgets b
          WHERE b.id = x.budget_id
            AND b.household_id = _household_id
        ) THEN x.budget_id
        ELSE NULL
      END,
      COALESCE(x.is_estimate, false)
    FROM jsonb_to_recordset(v_expenses) AS x(
      id uuid,
      name text,
      amount numeric,
      frequency_type text,
      frequency_param integer,
      benefit_x integer,
      category_id uuid,
      linked_account_id uuid,
      budget_id uuid,
      is_estimate boolean
    );
  END IF;

  SELECT jsonb_build_object(
    'categories', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name)
        FROM public.budget_categories c
        WHERE c.household_id = _household_id
      ),
      '[]'::jsonb
    ),
    'linkedAccounts', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(la) ORDER BY la.name)
        FROM public.budget_linked_accounts la
        WHERE la.household_id = _household_id
      ),
      '[]'::jsonb
    ),
    'incomes', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at)
        FROM public.budget_income_streams i
        WHERE i.household_id = _household_id
      ),
      '[]'::jsonb
    ),
    'expenses', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
        FROM public.budget_expenses e
        WHERE e.household_id = _household_id
      ),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Optional atomic drawers unit save
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drawers_save_unit(
  _unit_id uuid,
  _household_id uuid,
  _name text,
  _width integer,
  _height integer,
  _frame_color text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit_id uuid := _unit_id;
  v_household_id uuid;
  v_name text := NULLIF(trim(_name), '');
  v_frame_color text := lower(COALESCE(NULLIF(trim(_frame_color), ''), 'white'));
  v_width integer := _width;
  v_height integer := _height;
  v_next_sort integer;
  v_row public.drawers_units%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL THEN
    v_name := 'Untitled unit';
  END IF;

  IF v_width < 1 OR v_width > 6 OR v_height < 1 OR v_height > 6 THEN
    RAISE EXCEPTION 'Unit dimensions must be between 1 and 6';
  END IF;

  IF v_frame_color NOT IN ('black', 'brown', 'white') THEN
    v_frame_color := 'white';
  END IF;

  IF v_unit_id IS NULL THEN
    IF _household_id IS NULL THEN
      RAISE EXCEPTION 'household_id is required when creating a unit';
    END IF;

    IF NOT public.is_drawers_household_member(auth.uid(), _household_id) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(MAX(sort_order), -1) + 1
      INTO v_next_sort
    FROM public.drawers_units
    WHERE household_id = _household_id;

    INSERT INTO public.drawers_units (
      household_id,
      name,
      width,
      height,
      frame_color,
      sort_order
    )
    VALUES (
      _household_id,
      v_name,
      v_width,
      v_height,
      v_frame_color,
      v_next_sort
    )
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
  END IF;

  SELECT household_id
    INTO v_household_id
  FROM public.drawers_units
  WHERE id = v_unit_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Unit not found';
  END IF;

  IF _household_id IS NOT NULL AND _household_id <> v_household_id THEN
    RAISE EXCEPTION 'Unit belongs to a different household';
  END IF;

  IF NOT public.is_drawers_household_member(auth.uid(), v_household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drawers_units u
    WHERE u.id = v_unit_id
      AND (u.width <> v_width OR u.height <> v_height)
  ) THEN
    PERFORM public.resize_drawers_unit(v_unit_id, v_width, v_height);
  END IF;

  UPDATE public.drawers_units
  SET name = v_name,
      frame_color = v_frame_color,
      updated_at = now()
  WHERE id = v_unit_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.budget_reassign_category_and_delete(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_reassign_linked_account_and_delete(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_create_household_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_join_household_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_update_partner_names(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_restore_household_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_save_unit(uuid, uuid, text, integer, integer, text) TO authenticated;

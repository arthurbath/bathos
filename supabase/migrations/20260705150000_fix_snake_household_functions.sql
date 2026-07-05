-- Fix Snake household functions under locked search paths.

ALTER TABLE public.snake_households
  ALTER COLUMN invite_code SET DEFAULT encode(extensions.gen_random_bytes(6), 'hex');

CREATE OR REPLACE FUNCTION public.snake_list_household_members(_household_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  is_self boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_snake_household_member(v_user_id, _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    hm.user_id,
    u.email::text,
    NULLIF(trim(p.display_name), '')::text,
    hm.created_at,
    hm.user_id = v_user_id
  FROM public.snake_household_members hm
  LEFT JOIN auth.users u
    ON u.id = hm.user_id
  LEFT JOIN public.bathos_profiles p
    ON p.id = hm.user_id
  WHERE hm.household_id = _household_id
  ORDER BY hm.created_at ASC, hm.user_id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.snake_rotate_household_invite_code(_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_household public.snake_households%ROWTYPE;
  v_next_code text;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_snake_household_member(v_user_id, _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_next_code := encode(extensions.gen_random_bytes(6), 'hex');

    BEGIN
      UPDATE public.snake_households
      SET invite_code = v_next_code
      WHERE id = _household_id
      RETURNING * INTO v_household;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'Failed to generate unique invite code';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'inviteCode', v_household.invite_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.snake_remove_household_member(
  _household_id uuid,
  _member_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_household public.snake_households%ROWTYPE;
  v_next_code text;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _member_user_id = v_user_id THEN
    RAISE EXCEPTION 'Use leave household to remove yourself';
  END IF;

  IF NOT public.is_snake_household_member(v_user_id, _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.snake_household_members
    WHERE household_id = _household_id
      AND user_id = _member_user_id
  ) THEN
    RAISE EXCEPTION 'Member not found in household';
  END IF;

  DELETE FROM public.snake_household_members
  WHERE household_id = _household_id
    AND user_id = _member_user_id;

  LOOP
    v_attempt := v_attempt + 1;
    v_next_code := encode(extensions.gen_random_bytes(6), 'hex');

    BEGIN
      UPDATE public.snake_households
      SET invite_code = v_next_code
      WHERE id = _household_id
      RETURNING * INTO v_household;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'Failed to generate unique invite code';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'removedUserId', _member_user_id,
    'inviteCode', v_household.invite_code
  );
END;
$$;

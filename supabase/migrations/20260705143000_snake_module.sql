-- Snake module schema, household controls, ball-python growth ranges, and Babylon import.

CREATE TABLE public.snake_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Snake Household',
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.snake_household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.snake_households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX snake_household_members_user_id_unique_idx
  ON public.snake_household_members(user_id);

CREATE UNIQUE INDEX snake_household_members_household_user_unique_idx
  ON public.snake_household_members(household_id, user_id);

CREATE INDEX snake_household_members_household_id_idx
  ON public.snake_household_members(household_id);

CREATE TABLE public.snake_snakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.snake_households(id) ON DELETE CASCADE,
  name text NOT NULL,
  birthday date NOT NULL,
  species text NOT NULL DEFAULT 'Ball Python',
  growth_profile text NOT NULL DEFAULT 'ball_python',
  morph text,
  sex text NOT NULL DEFAULT 'unknown' CHECK (sex IN ('unknown', 'female', 'male')),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, household_id)
);

CREATE INDEX snake_snakes_household_sort_idx
  ON public.snake_snakes(household_id, sort_order, created_at);

CREATE TABLE public.snake_growth_expectation_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile text NOT NULL,
  range_label text NOT NULL,
  age_lower_months numeric NOT NULL CHECK (age_lower_months >= 0),
  age_upper_months numeric CHECK (age_upper_months IS NULL OR age_upper_months > age_lower_months),
  growth_lower_grams_per_month numeric NOT NULL CHECK (growth_lower_grams_per_month >= 0),
  growth_upper_grams_per_month numeric NOT NULL CHECK (growth_upper_grams_per_month >= growth_lower_grams_per_month),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile, range_label)
);

CREATE INDEX snake_growth_expectation_ranges_profile_sort_idx
  ON public.snake_growth_expectation_ranges(profile, sort_order);

CREATE TABLE public.snake_weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  snake_id uuid NOT NULL,
  recorded_on date NOT NULL,
  weight_grams integer NOT NULL CHECK (weight_grams > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (snake_id, household_id)
    REFERENCES public.snake_snakes(id, household_id)
    ON DELETE CASCADE,
  UNIQUE (snake_id, recorded_on)
);

CREATE INDEX snake_weight_records_household_snake_date_idx
  ON public.snake_weight_records(household_id, snake_id, recorded_on DESC);

CREATE OR REPLACE FUNCTION public.is_snake_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.snake_household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
  )
$$;

CREATE OR REPLACE FUNCTION public.lookup_snake_household_by_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM public.snake_households
    WHERE invite_code = _code
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.snake_create_household_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_household public.snake_households%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.snake_household_members
    WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You already belong to a snake household';
  END IF;

  SELECT NULLIF(trim(display_name), '')
    INTO v_display_name
  FROM public.bathos_profiles
  WHERE id = v_user_id;

  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'Please set your display name before creating a household';
  END IF;

  INSERT INTO public.snake_households DEFAULT VALUES
  RETURNING * INTO v_household;

  INSERT INTO public.snake_household_members (household_id, user_id)
  VALUES (v_household.id, v_user_id);

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'householdName', v_household.name,
    'inviteCode', v_household.invite_code,
    'displayName', v_display_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.snake_join_household_for_current_user(_invite_code text)
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
  v_household public.snake_households%ROWTYPE;
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

  v_household_id := public.lookup_snake_household_by_invite_code(v_normalized_code);

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT household_id
    INTO v_existing_household_id
  FROM public.snake_household_members
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_household_id IS NOT NULL THEN
    IF v_existing_household_id = v_household_id THEN
      RAISE EXCEPTION 'You are already a member of this snake household';
    END IF;
    RAISE EXCEPTION 'You already belong to a different snake household';
  END IF;

  INSERT INTO public.snake_household_members (household_id, user_id)
  VALUES (v_household_id, v_user_id);

  SELECT *
    INTO v_household
  FROM public.snake_households
  WHERE id = v_household_id;

  RETURN jsonb_build_object(
    'householdId', v_household.id,
    'householdName', v_household.name,
    'inviteCode', v_household.invite_code,
    'displayName', v_display_name
  );
END;
$$;

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
    u.email,
    NULLIF(trim(p.display_name), ''),
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
    v_next_code := encode(gen_random_bytes(6), 'hex');

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
    v_next_code := encode(gen_random_bytes(6), 'hex');

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

CREATE OR REPLACE FUNCTION public.snake_leave_household(_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_snake_household_member(v_user_id, _household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*)::integer
    INTO v_member_count
  FROM public.snake_household_members
  WHERE household_id = _household_id;

  IF v_member_count <= 1 THEN
    RAISE EXCEPTION 'Cannot leave household as sole member. Delete the household instead.';
  END IF;

  DELETE FROM public.snake_household_members
  WHERE household_id = _household_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'householdId', _household_id,
    'leftUserId', v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.snake_delete_household(_household_id uuid)
RETURNS jsonb
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

  DELETE FROM public.snake_households
  WHERE id = _household_id;

  RETURN jsonb_build_object(
    'householdId', _household_id,
    'deleted', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_snake_household_nonempty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    IF OLD.household_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.snake_households h
        WHERE h.id = OLD.household_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.snake_household_members hm
        WHERE hm.household_id = OLD.household_id
      ) THEN
      RAISE EXCEPTION 'Snake households must have at least one member';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.household_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.snake_households h
        WHERE h.id = NEW.household_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.snake_household_members hm
        WHERE hm.household_id = NEW.household_id
      ) THEN
      RAISE EXCEPTION 'Snake households must have at least one member';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER snake_household_members_nonempty_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.snake_household_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_snake_household_nonempty();

CREATE OR REPLACE FUNCTION public.enforce_snake_household_row_nonempty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.snake_households h
      WHERE h.id = NEW.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.snake_household_members hm
      WHERE hm.household_id = NEW.id
    ) THEN
    RAISE EXCEPTION 'Snake households must have at least one member';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER snake_households_nonempty_trigger
AFTER INSERT OR UPDATE ON public.snake_households
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_snake_household_row_nonempty();

ALTER TABLE public.snake_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snake_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snake_snakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snake_growth_expectation_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snake_weight_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view snake households"
ON public.snake_households
FOR SELECT
TO authenticated
USING (public.is_snake_household_member(auth.uid(), id));

CREATE POLICY "Members can update snake households"
ON public.snake_households
FOR UPDATE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), id))
WITH CHECK (public.is_snake_household_member(auth.uid(), id));

CREATE POLICY "Members can delete snake households"
ON public.snake_households
FOR DELETE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), id));

CREATE POLICY "Members can view snake household members"
ON public.snake_household_members
FOR SELECT
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can view snake expectation ranges"
ON public.snake_growth_expectation_ranges
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Members can view snakes"
ON public.snake_snakes
FOR SELECT
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can insert snakes"
ON public.snake_snakes
FOR INSERT
TO authenticated
WITH CHECK (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can update snakes"
ON public.snake_snakes
FOR UPDATE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id))
WITH CHECK (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can delete snakes"
ON public.snake_snakes
FOR DELETE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can view snake weight records"
ON public.snake_weight_records
FOR SELECT
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can insert snake weight records"
ON public.snake_weight_records
FOR INSERT
TO authenticated
WITH CHECK (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can update snake weight records"
ON public.snake_weight_records
FOR UPDATE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id))
WITH CHECK (public.is_snake_household_member(auth.uid(), household_id));

CREATE POLICY "Members can delete snake weight records"
ON public.snake_weight_records
FOR DELETE
TO authenticated
USING (public.is_snake_household_member(auth.uid(), household_id));

REVOKE ALL ON TABLE public.snake_households FROM anon, authenticated;
REVOKE ALL ON TABLE public.snake_household_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.snake_growth_expectation_ranges FROM anon, authenticated;
REVOKE ALL ON TABLE public.snake_snakes FROM anon, authenticated;
REVOKE ALL ON TABLE public.snake_weight_records FROM anon, authenticated;

GRANT SELECT ON TABLE public.snake_households TO authenticated, service_role;
GRANT SELECT ON TABLE public.snake_household_members TO authenticated, service_role;
GRANT SELECT ON TABLE public.snake_growth_expectation_ranges TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.snake_snakes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.snake_weight_records TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_snake_household_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.lookup_snake_household_by_invite_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snake_create_household_for_current_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_join_household_for_current_user(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_list_household_members(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_rotate_household_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_remove_household_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_leave_household(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snake_delete_household(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.snake_create_household_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_join_household_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_list_household_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_rotate_household_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_remove_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snake_delete_household(uuid) TO authenticated;

INSERT INTO public.snake_growth_expectation_ranges (
  profile,
  range_label,
  age_lower_months,
  age_upper_months,
  growth_lower_grams_per_month,
  growth_upper_grams_per_month,
  sort_order
)
VALUES
  ('ball_python', '0-3', 0, 3, 30, 50, 1),
  ('ball_python', '3-6', 3, 6, 40, 80, 2),
  ('ball_python', '6-12', 6, 12, 50, 100, 3),
  ('ball_python', '12-24', 12, 24, 30, 80, 4),
  ('ball_python', '24-36', 24, 36, 20, 50, 5),
  ('ball_python', '36+', 36, NULL, 0, 20, 6)
ON CONFLICT (profile, range_label) DO UPDATE
SET age_lower_months = EXCLUDED.age_lower_months,
    age_upper_months = EXCLUDED.age_upper_months,
    growth_lower_grams_per_month = EXCLUDED.growth_lower_grams_per_month,
    growth_upper_grams_per_month = EXCLUDED.growth_upper_grams_per_month,
    sort_order = EXCLUDED.sort_order;

DO $$
DECLARE
  v_user_id uuid;
  v_household_id uuid;
  v_seed_household_id uuid := '7c807bc2-4fd1-4fec-86df-ff8e537263dd';
  v_snake_id uuid := 'aab9f9f7-7b42-46a7-ad64-75ddfc7b609f';
BEGIN
  SELECT id
    INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'art@bath.garden'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT household_id
    INTO v_household_id
  FROM public.snake_household_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_household_id IS NULL THEN
    v_household_id := v_seed_household_id;

    INSERT INTO public.snake_households (id, name)
    VALUES (v_household_id, 'Babylon Household')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.snake_household_members (household_id, user_id)
    VALUES (v_household_id, v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.snake_snakes (
    id,
    household_id,
    name,
    birthday,
    species,
    growth_profile,
    sort_order,
    notes
  )
  VALUES (
    v_snake_id,
    v_household_id,
    'Babylon',
    '2024-11-27',
    'Ball Python',
    'ball_python',
    1,
    'Imported from the Babylon Airtable base.'
  )
  ON CONFLICT (id) DO UPDATE
  SET household_id = EXCLUDED.household_id,
      name = EXCLUDED.name,
      birthday = EXCLUDED.birthday,
      species = EXCLUDED.species,
      growth_profile = EXCLUDED.growth_profile,
      sort_order = EXCLUDED.sort_order,
      notes = EXCLUDED.notes,
      updated_at = now();

  INSERT INTO public.snake_weight_records (household_id, snake_id, recorded_on, weight_grams)
  VALUES
    (v_household_id, v_snake_id, '2025-01-31', 143),
    (v_household_id, v_snake_id, '2025-03-02', 188),
    (v_household_id, v_snake_id, '2025-04-01', 229),
    (v_household_id, v_snake_id, '2025-05-01', 266),
    (v_household_id, v_snake_id, '2025-06-01', 269),
    (v_household_id, v_snake_id, '2025-07-01', 294),
    (v_household_id, v_snake_id, '2025-08-03', 299),
    (v_household_id, v_snake_id, '2025-09-01', 365),
    (v_household_id, v_snake_id, '2025-10-01', 407),
    (v_household_id, v_snake_id, '2025-11-01', 415),
    (v_household_id, v_snake_id, '2025-12-04', 436),
    (v_household_id, v_snake_id, '2026-01-03', 457),
    (v_household_id, v_snake_id, '2026-02-08', 505),
    (v_household_id, v_snake_id, '2026-03-05', 504),
    (v_household_id, v_snake_id, '2026-04-05', 575),
    (v_household_id, v_snake_id, '2026-05-03', 537),
    (v_household_id, v_snake_id, '2026-06-05', 528)
  ON CONFLICT (snake_id, recorded_on) DO UPDATE
  SET household_id = EXCLUDED.household_id,
      weight_grams = EXCLUDED.weight_grams,
      updated_at = now();
END;
$$;

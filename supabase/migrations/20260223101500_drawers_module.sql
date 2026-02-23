-- Drawer Planner beta module schema

CREATE TABLE public.drawers_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Drawer Household',
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.drawers_household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.drawers_households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE TABLE public.drawers_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.drawers_households(id) ON DELETE CASCADE,
  name text NOT NULL,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 6),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 6),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.drawers_insert_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.drawers_households(id) ON DELETE CASCADE,
  insert_type text NOT NULL CHECK (insert_type IN ('black', 'wicker', 'blank')),
  label text,
  location_kind text NOT NULL CHECK (location_kind IN ('limbo', 'cubby')),
  unit_id uuid REFERENCES public.drawers_units(id) ON DELETE SET NULL,
  cubby_x integer,
  cubby_y integer,
  limbo_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (
      location_kind = 'cubby'
      AND unit_id IS NOT NULL
      AND cubby_x IS NOT NULL
      AND cubby_x >= 1
      AND cubby_y IS NOT NULL
      AND cubby_y >= 1
      AND limbo_order IS NULL
    )
    OR
    (
      location_kind = 'limbo'
      AND unit_id IS NULL
      AND cubby_x IS NULL
      AND cubby_y IS NULL
      AND limbo_order IS NOT NULL
    )
  )
);

CREATE INDEX drawers_household_members_user_id_idx
  ON public.drawers_household_members(user_id);

CREATE INDEX drawers_units_household_sort_order_idx
  ON public.drawers_units(household_id, sort_order);

CREATE INDEX drawers_insert_instances_household_location_idx
  ON public.drawers_insert_instances(household_id, location_kind, limbo_order);

CREATE UNIQUE INDEX drawers_insert_instances_unique_cubby_idx
  ON public.drawers_insert_instances(unit_id, cubby_x, cubby_y)
  WHERE location_kind = 'cubby';

CREATE OR REPLACE FUNCTION public.is_drawers_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drawers_household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
  )
$$;

CREATE OR REPLACE FUNCTION public.lookup_drawers_household_by_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM public.drawers_households
    WHERE invite_code = _code
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.move_drawers_insert_to_limbo(_insert_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id uuid;
  v_next_limbo_order integer;
BEGIN
  SELECT household_id
    INTO v_household_id
  FROM public.drawers_insert_instances
  WHERE id = _insert_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Insert instance not found';
  END IF;

  IF NOT public.is_drawers_household_member(auth.uid(), v_household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(MAX(limbo_order), 0) + 1
    INTO v_next_limbo_order
  FROM public.drawers_insert_instances
  WHERE household_id = v_household_id
    AND location_kind = 'limbo';

  UPDATE public.drawers_insert_instances
  SET location_kind = 'limbo',
      unit_id = NULL,
      cubby_x = NULL,
      cubby_y = NULL,
      limbo_order = v_next_limbo_order,
      updated_at = now()
  WHERE id = _insert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_drawers_insert(
  _insert_id uuid,
  _target_unit_id uuid,
  _target_x integer,
  _target_y integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_source public.drawers_insert_instances%ROWTYPE;
  v_target public.drawers_insert_instances%ROWTYPE;
  v_target_household_id uuid;
  v_next_limbo_order integer;
BEGIN
  IF _target_x < 1 OR _target_y < 1 THEN
    RAISE EXCEPTION 'Cubby coordinates must be positive';
  END IF;

  SELECT *
    INTO v_source
  FROM public.drawers_insert_instances
  WHERE id = _insert_id
  FOR UPDATE;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Insert instance not found';
  END IF;

  IF NOT public.is_drawers_household_member(auth.uid(), v_source.household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT household_id
    INTO v_target_household_id
  FROM public.drawers_units
  WHERE id = _target_unit_id;

  IF v_target_household_id IS NULL THEN
    RAISE EXCEPTION 'Target unit not found';
  END IF;

  IF v_target_household_id <> v_source.household_id THEN
    RAISE EXCEPTION 'Target unit belongs to a different household';
  END IF;

  IF v_source.location_kind = 'cubby'
     AND v_source.unit_id = _target_unit_id
     AND v_source.cubby_x = _target_x
     AND v_source.cubby_y = _target_y THEN
    RETURN;
  END IF;

  SELECT *
    INTO v_target
  FROM public.drawers_insert_instances
  WHERE unit_id = _target_unit_id
    AND cubby_x = _target_x
    AND cubby_y = _target_y
    AND location_kind = 'cubby'
    AND id <> _insert_id
  FOR UPDATE;

  IF v_target.id IS NOT NULL THEN
    IF v_source.location_kind = 'cubby' THEN
      UPDATE public.drawers_insert_instances
      SET location_kind = 'cubby',
          unit_id = v_source.unit_id,
          cubby_x = v_source.cubby_x,
          cubby_y = v_source.cubby_y,
          limbo_order = NULL,
          updated_at = now()
      WHERE id = v_target.id;
    ELSE
      SELECT COALESCE(MAX(limbo_order), 0) + 1
        INTO v_next_limbo_order
      FROM public.drawers_insert_instances
      WHERE household_id = v_source.household_id
        AND location_kind = 'limbo';

      UPDATE public.drawers_insert_instances
      SET location_kind = 'limbo',
          unit_id = NULL,
          cubby_x = NULL,
          cubby_y = NULL,
          limbo_order = v_next_limbo_order,
          updated_at = now()
      WHERE id = v_target.id;
    END IF;
  END IF;

  UPDATE public.drawers_insert_instances
  SET location_kind = 'cubby',
      unit_id = _target_unit_id,
      cubby_x = _target_x,
      cubby_y = _target_y,
      limbo_order = NULL,
      updated_at = now()
  WHERE id = _insert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resize_drawers_unit(
  _unit_id uuid,
  _new_w integer,
  _new_h integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id uuid;
  v_next_limbo_order integer;
BEGIN
  IF _new_w < 1 OR _new_w > 6 OR _new_h < 1 OR _new_h > 6 THEN
    RAISE EXCEPTION 'Unit dimensions must be between 1 and 6';
  END IF;

  SELECT household_id
    INTO v_household_id
  FROM public.drawers_units
  WHERE id = _unit_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Unit not found';
  END IF;

  IF NOT public.is_drawers_household_member(auth.uid(), v_household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.drawers_units
  SET width = _new_w,
      height = _new_h,
      updated_at = now()
  WHERE id = _unit_id;

  SELECT COALESCE(MAX(limbo_order), 0) + 1
    INTO v_next_limbo_order
  FROM public.drawers_insert_instances
  WHERE household_id = v_household_id
    AND location_kind = 'limbo';

  WITH displaced AS (
    SELECT id,
           row_number() OVER (ORDER BY created_at, id) AS rn
    FROM public.drawers_insert_instances
    WHERE unit_id = _unit_id
      AND location_kind = 'cubby'
      AND (cubby_x > _new_w OR cubby_y > _new_h)
  )
  UPDATE public.drawers_insert_instances di
  SET location_kind = 'limbo',
      unit_id = NULL,
      cubby_x = NULL,
      cubby_y = NULL,
      limbo_order = v_next_limbo_order + displaced.rn - 1,
      updated_at = now()
  FROM displaced
  WHERE di.id = displaced.id;
END;
$$;

ALTER TABLE public.drawers_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawers_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawers_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawers_insert_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view drawers households"
ON public.drawers_households
FOR SELECT
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create drawers households"
ON public.drawers_households
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can update drawers households"
ON public.drawers_households
FOR UPDATE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), id));

CREATE POLICY "Members can delete drawers households"
ON public.drawers_households
FOR DELETE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), id));

CREATE POLICY "Members can view drawers household members"
ON public.drawers_household_members
FOR SELECT
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Authenticated users can join drawers households"
ON public.drawers_household_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave drawers household membership"
ON public.drawers_household_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can view drawers units"
ON public.drawers_units
FOR SELECT
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can insert drawers units"
ON public.drawers_units
FOR INSERT
TO authenticated
WITH CHECK (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can update drawers units"
ON public.drawers_units
FOR UPDATE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id))
WITH CHECK (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can delete drawers units"
ON public.drawers_units
FOR DELETE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can view drawers inserts"
ON public.drawers_insert_instances
FOR SELECT
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can insert drawers inserts"
ON public.drawers_insert_instances
FOR INSERT
TO authenticated
WITH CHECK (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can update drawers inserts"
ON public.drawers_insert_instances
FOR UPDATE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id))
WITH CHECK (public.is_drawers_household_member(auth.uid(), household_id));

CREATE POLICY "Members can delete drawers inserts"
ON public.drawers_insert_instances
FOR DELETE
TO authenticated
USING (public.is_drawers_household_member(auth.uid(), household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawers_households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawers_household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawers_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawers_insert_instances TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_drawers_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_drawers_household_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_insert_to_limbo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_insert(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resize_drawers_unit(uuid, integer, integer) TO authenticated;

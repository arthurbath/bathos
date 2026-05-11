-- Recreate Drawers move RPCs with drawer-named argument names for PostgREST schema matching.

DROP FUNCTION IF EXISTS public.move_drawers_drawer(uuid, uuid, integer, integer);

CREATE FUNCTION public.move_drawers_drawer(
  _drawer_id uuid,
  _target_unit_id uuid,
  _target_x integer,
  _target_y integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_source public.drawers_instances%ROWTYPE;
  v_target public.drawers_instances%ROWTYPE;
  v_target_household_id uuid;
  v_next_limbo_order integer;
BEGIN
  IF _target_x < 1 OR _target_y < 1 THEN
    RAISE EXCEPTION 'Cubby coordinates must be positive';
  END IF;

  SELECT *
    INTO v_source
  FROM public.drawers_instances
  WHERE id = _drawer_id
  FOR UPDATE;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Drawer instance not found';
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
  FROM public.drawers_instances
  WHERE unit_id = _target_unit_id
    AND cubby_x = _target_x
    AND cubby_y = _target_y
    AND location_kind = 'cubby'
    AND id <> _drawer_id
  FOR UPDATE;

  IF v_target.id IS NOT NULL THEN
    SELECT COALESCE(MAX(limbo_order), 0) + 1
      INTO v_next_limbo_order
    FROM public.drawers_instances
    WHERE household_id = v_source.household_id
      AND location_kind = 'limbo';

    UPDATE public.drawers_instances
    SET location_kind = 'limbo',
        unit_id = NULL,
        cubby_x = NULL,
        cubby_y = NULL,
        limbo_order = v_next_limbo_order,
        updated_at = now()
    WHERE id = v_target.id;
  END IF;

  UPDATE public.drawers_instances
  SET location_kind = 'cubby',
      unit_id = _target_unit_id,
      cubby_x = _target_x,
      cubby_y = _target_y,
      limbo_order = NULL,
      updated_at = now()
  WHERE id = _drawer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_drawers_drawer(uuid, uuid, integer, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.move_drawers_drawer_to_limbo(uuid);

CREATE FUNCTION public.move_drawers_drawer_to_limbo(_drawer_id uuid)
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
  FROM public.drawers_instances
  WHERE id = _drawer_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Drawer instance not found';
  END IF;

  IF NOT public.is_drawers_household_member(auth.uid(), v_household_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(MAX(limbo_order), 0) + 1
    INTO v_next_limbo_order
  FROM public.drawers_instances
  WHERE household_id = v_household_id
    AND location_kind = 'limbo';

  UPDATE public.drawers_instances
  SET location_kind = 'limbo',
      unit_id = NULL,
      cubby_x = NULL,
      cubby_y = NULL,
      limbo_order = v_next_limbo_order,
      updated_at = now()
  WHERE id = _drawer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_drawers_drawer_to_limbo(uuid) TO authenticated;

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
BEGIN
  PERFORM public.move_drawers_drawer(_insert_id, _target_unit_id, _target_x, _target_y);
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_drawers_insert(uuid, uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_drawers_insert_to_limbo(_insert_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.move_drawers_drawer_to_limbo(_insert_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_drawers_insert_to_limbo(uuid) TO authenticated;

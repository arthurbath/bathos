-- Drawer Planner: placing into an occupied cubby moves the previous insert to limbo

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

GRANT EXECUTE ON FUNCTION public.move_drawers_insert(uuid, uuid, integer, integer) TO authenticated;

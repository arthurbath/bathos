-- Drawer Planner: bulk move all cubby inserts in a unit to limbo in one transaction

CREATE OR REPLACE FUNCTION public.move_drawers_unit_inserts_to_limbo(_unit_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id uuid;
  v_next_limbo_order integer;
  v_moved_count integer;
BEGIN
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
    FOR UPDATE
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

  GET DIAGNOSTICS v_moved_count = ROW_COUNT;
  RETURN v_moved_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_drawers_unit_inserts_to_limbo(uuid) TO authenticated;

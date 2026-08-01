-- Rebind the Drawers resize routine to the renamed drawers_instances table.
-- The original table rename did not rewrite this production function body,
-- leaving unit resize calls unable to resolve drawers_insert_instances.

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
  FROM public.drawers_instances
  WHERE household_id = v_household_id
    AND location_kind = 'limbo';

  WITH displaced AS (
    SELECT id,
           row_number() OVER (ORDER BY created_at, id) AS rn
    FROM public.drawers_instances
    WHERE unit_id = _unit_id
      AND location_kind = 'cubby'
      AND (cubby_x > _new_w OR cubby_y > _new_h)
  )
  UPDATE public.drawers_instances AS instance
  SET location_kind = 'limbo',
      unit_id = NULL,
      cubby_x = NULL,
      cubby_y = NULL,
      limbo_order = v_next_limbo_order + displaced.rn - 1,
      updated_at = now()
  FROM displaced
  WHERE instance.id = displaced.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resize_drawers_unit(uuid, integer, integer)
TO authenticated;

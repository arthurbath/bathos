-- Rename Drawers insert-oriented schema objects to drawer-oriented names.
-- Safe to run on both existing and fresh environments.

DO $$
BEGIN
  IF to_regclass('public.drawers_insert_instances') IS NOT NULL
     AND to_regclass('public.drawers_instances') IS NULL THEN
    ALTER TABLE public.drawers_insert_instances RENAME TO drawers_instances;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drawers_instances'
      AND column_name = 'insert_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drawers_instances'
      AND column_name = 'drawer_type'
  ) THEN
    ALTER TABLE public.drawers_instances RENAME COLUMN insert_type TO drawer_type;
  END IF;
END
$$;

ALTER INDEX IF EXISTS public.drawers_insert_instances_household_location_idx
  RENAME TO drawers_instances_household_location_idx;

ALTER INDEX IF EXISTS public.drawers_insert_instances_unique_cubby_idx
  RENAME TO drawers_instances_unique_cubby_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drawers_insert_instances_household_id_fkey'
      AND conrelid = 'public.drawers_instances'::regclass
  ) THEN
    ALTER TABLE public.drawers_instances
      RENAME CONSTRAINT drawers_insert_instances_household_id_fkey
      TO drawers_instances_household_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drawers_insert_instances_unit_id_fkey'
      AND conrelid = 'public.drawers_instances'::regclass
  ) THEN
    ALTER TABLE public.drawers_instances
      RENAME CONSTRAINT drawers_insert_instances_unit_id_fkey
      TO drawers_instances_unit_id_fkey;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'move_drawers_insert_to_limbo'
      AND pg_function_is_visible(oid)
  ) THEN
    ALTER FUNCTION public.move_drawers_insert_to_limbo(uuid)
      RENAME TO move_drawers_drawer_to_limbo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'move_drawers_insert'
      AND pg_function_is_visible(oid)
  ) THEN
    ALTER FUNCTION public.move_drawers_insert(uuid, uuid, integer, integer)
      RENAME TO move_drawers_drawer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'move_drawers_unit_inserts_to_limbo'
      AND pg_function_is_visible(oid)
  ) THEN
    ALTER FUNCTION public.move_drawers_unit_inserts_to_limbo(uuid)
      RENAME TO move_drawers_unit_drawers_to_limbo;
  END IF;
END
$$;

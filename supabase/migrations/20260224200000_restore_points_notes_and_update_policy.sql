-- Canonicalize backup note storage and allow note edits.
-- 1) Ensure the note column is `notes` (migrate from `name` if needed).
-- 2) Ensure UPDATE is permitted by RLS for household members.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_restore_points'
      AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_restore_points'
      AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.budget_restore_points RENAME COLUMN name TO notes;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_restore_points'
      AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_restore_points'
      AND column_name = 'notes'
  ) THEN
    UPDATE public.budget_restore_points
    SET notes = name
    WHERE (notes IS NULL OR btrim(notes) = '')
      AND name IS NOT NULL
      AND btrim(name) <> '';

    ALTER TABLE public.budget_restore_points DROP COLUMN name;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_restore_points'
      AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.budget_restore_points ADD COLUMN notes text;
  END IF;
END
$$;

DROP POLICY IF EXISTS "Members can update restore points" ON public.budget_restore_points;
CREATE POLICY "Members can update restore points"
  ON public.budget_restore_points FOR UPDATE
  TO authenticated
  USING (public.is_household_member(auth.uid(), household_id))
  WITH CHECK (public.is_household_member(auth.uid(), household_id));

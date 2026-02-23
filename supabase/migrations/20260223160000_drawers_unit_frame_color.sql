-- Add configurable frame color for Drawer Planner units.
ALTER TABLE public.drawers_units
ADD COLUMN IF NOT EXISTS frame_color text;

UPDATE public.drawers_units
SET frame_color = 'white'
WHERE frame_color IS NULL;

ALTER TABLE public.drawers_units
ALTER COLUMN frame_color SET DEFAULT 'white';

ALTER TABLE public.drawers_units
ALTER COLUMN frame_color SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drawers_units_frame_color_check'
  ) THEN
    ALTER TABLE public.drawers_units
    ADD CONSTRAINT drawers_units_frame_color_check
    CHECK (frame_color IN ('black', 'brown', 'white'));
  END IF;
END $$;

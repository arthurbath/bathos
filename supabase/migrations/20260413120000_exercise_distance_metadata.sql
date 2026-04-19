ALTER TABLE public.exercise_definitions
ADD COLUMN distance_miles numeric(8, 2) CHECK (distance_miles IS NULL OR distance_miles > 0);

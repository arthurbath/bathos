-- Exercise module schema (admin-only, user-owned)

CREATE TABLE public.exercise_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  rep_count integer CHECK (rep_count IS NULL OR rep_count > 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  weight_lbs numeric(8, 2) CHECK (weight_lbs IS NULL OR weight_lbs > 0),
  weight_delta_lbs numeric(8, 2) CHECK (weight_delta_lbs IS NULL OR weight_delta_lbs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_definitions_weight_delta_requires_weight
    CHECK (weight_delta_lbs IS NULL OR weight_lbs IS NOT NULL)
);

CREATE TABLE public.exercise_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exercise_routine_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.exercise_routines(id) ON DELETE CASCADE,
  exercise_definition_id uuid NOT NULL REFERENCES public.exercise_definitions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX exercise_definitions_user_name_idx ON public.exercise_definitions (user_id, name);
CREATE INDEX exercise_routines_user_name_idx ON public.exercise_routines (user_id, name);
CREATE INDEX exercise_routine_items_routine_sort_idx ON public.exercise_routine_items (routine_id, sort_order, id);
CREATE INDEX exercise_routine_items_exercise_idx ON public.exercise_routine_items (exercise_definition_id);

ALTER TABLE public.exercise_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_routine_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own exercise definitions"
ON public.exercise_definitions
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own exercise definitions"
ON public.exercise_definitions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own exercise definitions"
ON public.exercise_definitions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own exercise definitions"
ON public.exercise_definitions
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own exercise routines"
ON public.exercise_routines
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own exercise routines"
ON public.exercise_routines
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own exercise routines"
ON public.exercise_routines
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own exercise routines"
ON public.exercise_routines
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own exercise routine items"
ON public.exercise_routine_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exercise_routines routines
    WHERE routines.id = exercise_routine_items.routine_id
      AND routines.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Admins can insert own exercise routine items"
ON public.exercise_routine_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.exercise_routines routines
    WHERE routines.id = exercise_routine_items.routine_id
      AND routines.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
  AND EXISTS (
    SELECT 1
    FROM public.exercise_definitions definitions
    WHERE definitions.id = exercise_routine_items.exercise_definition_id
      AND definitions.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Admins can update own exercise routine items"
ON public.exercise_routine_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exercise_routines routines
    WHERE routines.id = exercise_routine_items.routine_id
      AND routines.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.exercise_routines routines
    WHERE routines.id = exercise_routine_items.routine_id
      AND routines.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
  AND EXISTS (
    SELECT 1
    FROM public.exercise_definitions definitions
    WHERE definitions.id = exercise_routine_items.exercise_definition_id
      AND definitions.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Admins can delete own exercise routine items"
ON public.exercise_routine_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exercise_routines routines
    WHERE routines.id = exercise_routine_items.routine_id
      AND routines.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
);

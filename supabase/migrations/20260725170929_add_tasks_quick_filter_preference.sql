ALTER TABLE public.bathos_user_settings
ADD COLUMN tasks_quick_filter text NOT NULL DEFAULT 'all',
ADD COLUMN tasks_quick_filter_updated_at timestamptz NOT NULL
  DEFAULT '1970-01-01 00:00:00+00';

ALTER TABLE public.bathos_user_settings
ADD CONSTRAINT bathos_user_settings_tasks_quick_filter_valid
CHECK (
  tasks_quick_filter IN (
    'all',
    'actionable',
    'non_actionable',
    'rechecking',
    'waiting'
  )
);

DROP POLICY IF EXISTS "Users can update own settings"
ON public.bathos_user_settings;

CREATE POLICY "Users can update own settings"
ON public.bathos_user_settings
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.bathos_user_settings
ADD COLUMN IF NOT EXISTS grid_view_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

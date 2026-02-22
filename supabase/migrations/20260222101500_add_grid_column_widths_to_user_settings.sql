-- Persist per-user data grid column width preferences.
ALTER TABLE public.bathos_user_settings
ADD COLUMN IF NOT EXISTS grid_column_widths jsonb NOT NULL DEFAULT '{}'::jsonb;

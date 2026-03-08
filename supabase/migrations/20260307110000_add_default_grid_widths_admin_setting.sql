ALTER TABLE public.bathos_user_settings
ADD COLUMN IF NOT EXISTS use_default_grid_column_widths boolean NOT NULL DEFAULT false;

-- Track the current snake for Garage-style entity selection.

ALTER TABLE public.snake_snakes
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

WITH ranked_snakes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY household_id
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) AS row_number,
    bool_or(is_active) OVER (PARTITION BY household_id) AS household_has_active
  FROM public.snake_snakes
)
UPDATE public.snake_snakes AS snake
SET is_active = true,
    updated_at = now()
FROM ranked_snakes
WHERE snake.id = ranked_snakes.id
  AND ranked_snakes.row_number = 1
  AND NOT ranked_snakes.household_has_active;

CREATE INDEX IF NOT EXISTS snake_snakes_household_active_idx
  ON public.snake_snakes(household_id, is_active)
  WHERE is_active;

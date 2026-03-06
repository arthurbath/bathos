CREATE OR REPLACE FUNCTION public.budget_backfill_average_record_dates(
  _records jsonb,
  _value_type text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(_records, '[]'::jsonb)) <> 'array' THEN '[]'::jsonb
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(item) <> 'object' THEN item
            WHEN NULLIF(item->>'date', '') IS NOT NULL THEN item
            WHEN _value_type = 'monthly_averaged'
              AND (item->>'year') ~ '^\d{1,4}$'
              AND (item->>'month') ~ '^\d{1,2}$'
              AND ((item->>'month')::int BETWEEN 1 AND 12)
            THEN item || jsonb_build_object(
              'date',
              lpad(item->>'year', 4, '0') || '-' || lpad(item->>'month', 2, '0') || '-01'
            )
            WHEN _value_type = 'yearly_averaged'
              AND (item->>'year') ~ '^\d{1,4}$'
            THEN item || jsonb_build_object(
              'date',
              lpad(item->>'year', 4, '0') || '-01-01'
            )
            ELSE item
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(COALESCE(_records, '[]'::jsonb)) WITH ORDINALITY AS elements(item, ord)
      ),
      '[]'::jsonb
    )
  END;
$$;

UPDATE public.budget_expenses
SET average_records = public.budget_backfill_average_record_dates(average_records, value_type)
WHERE value_type IN ('monthly_averaged', 'yearly_averaged')
  AND jsonb_typeof(average_records) = 'array';

UPDATE public.budget_income_streams
SET average_records = public.budget_backfill_average_record_dates(average_records, value_type)
WHERE value_type IN ('monthly_averaged', 'yearly_averaged')
  AND jsonb_typeof(average_records) = 'array';

WITH transformed_restore_points AS (
  SELECT
    restore_point.id,
    jsonb_set(
      jsonb_set(
        restore_point.data,
        '{incomes}',
        COALESCE(
          (
            SELECT jsonb_agg(
              CASE
                WHEN jsonb_typeof(item) = 'object'
                  AND item->>'value_type' IN ('monthly_averaged', 'yearly_averaged')
                  AND jsonb_typeof(item->'average_records') = 'array'
                THEN jsonb_set(
                  item,
                  '{average_records}',
                  public.budget_backfill_average_record_dates(item->'average_records', item->>'value_type')
                )
                ELSE item
              END
              ORDER BY ord
            )
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(restore_point.data->'incomes') = 'array' THEN restore_point.data->'incomes'
                ELSE '[]'::jsonb
              END
            ) WITH ORDINALITY AS income_elements(item, ord)
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{expenses}',
      COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(item) = 'object'
                AND item->>'value_type' IN ('monthly_averaged', 'yearly_averaged')
                AND jsonb_typeof(item->'average_records') = 'array'
              THEN jsonb_set(
                item,
                '{average_records}',
                public.budget_backfill_average_record_dates(item->'average_records', item->>'value_type')
              )
              ELSE item
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(restore_point.data->'expenses') = 'array' THEN restore_point.data->'expenses'
              ELSE '[]'::jsonb
            END
          ) WITH ORDINALITY AS expense_elements(item, ord)
        ),
        '[]'::jsonb
      ),
      true
    ) AS next_data
  FROM public.budget_restore_points AS restore_point
  WHERE jsonb_typeof(restore_point.data) = 'object'
)
UPDATE public.budget_restore_points AS restore_point
SET data = transformed_restore_points.next_data
FROM transformed_restore_points
WHERE restore_point.id = transformed_restore_points.id
  AND restore_point.data IS DISTINCT FROM transformed_restore_points.next_data;

DROP FUNCTION public.budget_backfill_average_record_dates(jsonb, text);

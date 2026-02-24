-- Darken Budget category/payment-method palette colors so they remain legible with light text.
-- Also normalizes existing restore point snapshots so restores do not reintroduce old light colors.

WITH color_map(old_color, new_color) AS (
  VALUES
    ('#fecaca', '#b91c1c'),
    ('#fca5a5', '#b91c1c'),
    ('#fed7aa', '#c2410c'),
    ('#fdba74', '#c2410c'),
    ('#fde68a', '#b45309'),
    ('#fcd34d', '#b45309'),
    ('#bbf7d0', '#15803d'),
    ('#86efac', '#15803d'),
    ('#a5f3fc', '#0e7490'),
    ('#5eead4', '#0e7490'),
    ('#bfdbfe', '#1d4ed8'),
    ('#7dd3fc', '#1d4ed8'),
    ('#c7d2fe', '#4338ca'),
    ('#93c5fd', '#4338ca'),
    ('#ddd6fe', '#6d28d9'),
    ('#ede9fe', '#6d28d9'),
    ('#a78bfa', '#6d28d9'),
    ('#fbcfe8', '#be185d'),
    ('#f0abfc', '#be185d'),
    ('#e5e7eb', '#374151'),
    ('#9ca3af', '#374151')
)
UPDATE public.budget_categories AS category
SET color = color_map.new_color
FROM color_map
WHERE category.color IS NOT NULL
  AND lower(category.color) = color_map.old_color;

WITH color_map(old_color, new_color) AS (
  VALUES
    ('#fecaca', '#b91c1c'),
    ('#fca5a5', '#b91c1c'),
    ('#fed7aa', '#c2410c'),
    ('#fdba74', '#c2410c'),
    ('#fde68a', '#b45309'),
    ('#fcd34d', '#b45309'),
    ('#bbf7d0', '#15803d'),
    ('#86efac', '#15803d'),
    ('#a5f3fc', '#0e7490'),
    ('#5eead4', '#0e7490'),
    ('#bfdbfe', '#1d4ed8'),
    ('#7dd3fc', '#1d4ed8'),
    ('#c7d2fe', '#4338ca'),
    ('#93c5fd', '#4338ca'),
    ('#ddd6fe', '#6d28d9'),
    ('#ede9fe', '#6d28d9'),
    ('#a78bfa', '#6d28d9'),
    ('#fbcfe8', '#be185d'),
    ('#f0abfc', '#be185d'),
    ('#e5e7eb', '#374151'),
    ('#9ca3af', '#374151')
)
UPDATE public.budget_linked_accounts AS linked_account
SET color = color_map.new_color
FROM color_map
WHERE linked_account.color IS NOT NULL
  AND lower(linked_account.color) = color_map.old_color;

WITH color_map(old_color, new_color) AS (
  VALUES
    ('#fecaca', '#b91c1c'),
    ('#fca5a5', '#b91c1c'),
    ('#fed7aa', '#c2410c'),
    ('#fdba74', '#c2410c'),
    ('#fde68a', '#b45309'),
    ('#fcd34d', '#b45309'),
    ('#bbf7d0', '#15803d'),
    ('#86efac', '#15803d'),
    ('#a5f3fc', '#0e7490'),
    ('#5eead4', '#0e7490'),
    ('#bfdbfe', '#1d4ed8'),
    ('#7dd3fc', '#1d4ed8'),
    ('#c7d2fe', '#4338ca'),
    ('#93c5fd', '#4338ca'),
    ('#ddd6fe', '#6d28d9'),
    ('#ede9fe', '#6d28d9'),
    ('#a78bfa', '#6d28d9'),
    ('#fbcfe8', '#be185d'),
    ('#f0abfc', '#be185d'),
    ('#e5e7eb', '#374151'),
    ('#9ca3af', '#374151')
),
transformed_restore_points AS (
  SELECT
    restore_point.id,
    jsonb_set(
      jsonb_set(
        restore_point.data,
        '{categories}',
        COALESCE(
          (
            SELECT jsonb_agg(
              CASE
                WHEN jsonb_typeof(category_item) = 'object' AND category_item ? 'color' THEN
                  jsonb_set(
                    category_item,
                    '{color}',
                    to_jsonb(COALESCE(color_map.new_color, category_item->>'color')),
                    true
                  )
                ELSE category_item
              END
            )
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(restore_point.data->'categories') = 'array' THEN restore_point.data->'categories'
                ELSE '[]'::jsonb
              END
            ) AS category_item
            LEFT JOIN color_map ON lower(category_item->>'color') = color_map.old_color
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{linkedAccounts}',
      COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(linked_account_item) = 'object' AND linked_account_item ? 'color' THEN
                jsonb_set(
                  linked_account_item,
                  '{color}',
                  to_jsonb(COALESCE(color_map.new_color, linked_account_item->>'color')),
                  true
                )
              ELSE linked_account_item
            END
          )
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(restore_point.data->'linkedAccounts') = 'array' THEN restore_point.data->'linkedAccounts'
              ELSE '[]'::jsonb
            END
          ) AS linked_account_item
          LEFT JOIN color_map ON lower(linked_account_item->>'color') = color_map.old_color
        ),
        '[]'::jsonb
      ),
      true
    ) AS next_data
  FROM public.budget_restore_points AS restore_point
  WHERE restore_point.data ? 'categories' OR restore_point.data ? 'linkedAccounts'
)
UPDATE public.budget_restore_points AS restore_point
SET data = transformed_restore_points.next_data
FROM transformed_restore_points
WHERE restore_point.id = transformed_restore_points.id
  AND restore_point.data IS DISTINCT FROM transformed_restore_points.next_data;

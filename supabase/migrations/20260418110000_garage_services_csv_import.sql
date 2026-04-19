WITH normalized_names AS (
  SELECT
    id,
    COALESCE(NULLIF(BTRIM(name), ''), 'Unnamed Service') AS base_name,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, vehicle_id, LOWER(COALESCE(NULLIF(BTRIM(name), ''), 'Unnamed Service'))
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.garage_services
),
renamed_services AS (
  SELECT
    id,
    CASE
      WHEN duplicate_rank = 1 THEN base_name
      ELSE base_name || ' ' || duplicate_rank::text
    END AS next_name
  FROM normalized_names
)
UPDATE public.garage_services AS service
SET
  name = renamed_services.next_name,
  updated_at = now()
FROM renamed_services
WHERE service.id = renamed_services.id
  AND service.name IS DISTINCT FROM renamed_services.next_name;

ALTER TABLE public.garage_services
  ALTER COLUMN type DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'garage_services_name_not_blank'
  ) THEN
    ALTER TABLE public.garage_services
      ADD CONSTRAINT garage_services_name_not_blank
      CHECK (length(btrim(name)) > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS garage_services_unique_normalized_name_idx
  ON public.garage_services (user_id, vehicle_id, lower(btrim(name)));

CREATE OR REPLACE FUNCTION public.garage_import_services_csv(
  _vehicle_id uuid,
  _rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _row jsonb;
  _row_index integer := 0;
  _next_sort_order integer := 0;
  _name text;
  _service_id uuid;
  _created_names text[] := ARRAY[]::text[];
  _updated_names text[] := ARRAY[]::text[];
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows payload must be a JSON array.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.garage_vehicles
    WHERE id = _vehicle_id
      AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Vehicle not found.';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0)
  INTO _next_sort_order
  FROM public.garage_services
  WHERE user_id = _user_id
    AND vehicle_id = _vehicle_id;

  FOR _row IN SELECT value FROM jsonb_array_elements(_rows) AS value LOOP
    _row_index := _row_index + 1;
    _name := BTRIM(COALESCE(_row->>'name', ''));

    IF _name = '' THEN
      RAISE EXCEPTION 'Import row % is missing a Name.', _row_index;
    END IF;

    SELECT id
    INTO _service_id
    FROM public.garage_services
    WHERE user_id = _user_id
      AND vehicle_id = _vehicle_id
      AND LOWER(BTRIM(name)) = LOWER(_name)
    LIMIT 1;

    IF _service_id IS NULL THEN
      _next_sort_order := _next_sort_order + 1;

      INSERT INTO public.garage_services (
        user_id,
        vehicle_id,
        name,
        type,
        monitoring,
        cadence_type,
        every_miles,
        every_months,
        sort_order,
        notes
      )
      VALUES (
        _user_id,
        _vehicle_id,
        _name,
        CASE
          WHEN _row ? 'type' AND jsonb_typeof(_row->'type') <> 'null'
            THEN (_row->>'type')::public.garage_service_type
          ELSE NULL
        END,
        CASE
          WHEN _row ? 'monitoring' AND jsonb_typeof(_row->'monitoring') <> 'null'
            THEN (_row->>'monitoring')::boolean
          ELSE false
        END,
        CASE
          WHEN (_row ? 'every_miles' AND jsonb_typeof(_row->'every_miles') <> 'null')
            OR (_row ? 'every_months' AND jsonb_typeof(_row->'every_months') <> 'null')
            THEN 'recurring'::public.garage_cadence_type
          ELSE 'no_interval'::public.garage_cadence_type
        END,
        CASE
          WHEN _row ? 'every_miles' AND jsonb_typeof(_row->'every_miles') <> 'null'
            THEN (_row->>'every_miles')::integer
          ELSE NULL
        END,
        CASE
          WHEN _row ? 'every_months' AND jsonb_typeof(_row->'every_months') <> 'null'
            THEN (_row->>'every_months')::integer
          ELSE NULL
        END,
        _next_sort_order,
        CASE
          WHEN _row ? 'notes' AND jsonb_typeof(_row->'notes') <> 'null'
            THEN _row->>'notes'
          ELSE NULL
        END
      );

      _created_names := array_append(_created_names, _name);
    ELSE
      UPDATE public.garage_services AS service
      SET
        name = _name,
        type = CASE
          WHEN _row ? 'type' THEN
            CASE
              WHEN jsonb_typeof(_row->'type') = 'null' THEN NULL
              ELSE (_row->>'type')::public.garage_service_type
            END
          ELSE service.type
        END,
        monitoring = CASE
          WHEN _row ? 'monitoring' AND jsonb_typeof(_row->'monitoring') <> 'null'
            THEN (_row->>'monitoring')::boolean
          ELSE service.monitoring
        END,
        every_miles = CASE
          WHEN _row ? 'every_miles' AND jsonb_typeof(_row->'every_miles') <> 'null'
            THEN (_row->>'every_miles')::integer
          ELSE service.every_miles
        END,
        every_months = CASE
          WHEN _row ? 'every_months' AND jsonb_typeof(_row->'every_months') <> 'null'
            THEN (_row->>'every_months')::integer
          ELSE service.every_months
        END,
        notes = CASE
          WHEN _row ? 'notes' AND jsonb_typeof(_row->'notes') <> 'null'
            THEN _row->>'notes'
          ELSE service.notes
        END,
        cadence_type = CASE
          WHEN COALESCE(
            CASE
              WHEN _row ? 'every_miles' AND jsonb_typeof(_row->'every_miles') <> 'null'
                THEN (_row->>'every_miles')::integer
              ELSE service.every_miles
            END,
            0
          ) > 0
          OR COALESCE(
            CASE
              WHEN _row ? 'every_months' AND jsonb_typeof(_row->'every_months') <> 'null'
                THEN (_row->>'every_months')::integer
              ELSE service.every_months
            END,
            0
          ) > 0
            THEN 'recurring'::public.garage_cadence_type
          ELSE 'no_interval'::public.garage_cadence_type
        END,
        updated_at = now()
      WHERE service.id = _service_id
        AND service.user_id = _user_id
        AND service.vehicle_id = _vehicle_id;

      _updated_names := array_append(_updated_names, _name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', COALESCE(array_length(_created_names, 1), 0),
    'updated_count', COALESCE(array_length(_updated_names, 1), 0),
    'created_names', COALESCE(to_jsonb(_created_names), '[]'::jsonb),
    'updated_names', COALESCE(to_jsonb(_updated_names), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.garage_import_services_csv(uuid, jsonb) TO authenticated;

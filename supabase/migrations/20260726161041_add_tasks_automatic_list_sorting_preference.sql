ALTER TABLE public.tasks_user_settings
ADD COLUMN automatic_list_sorting boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION tasks_private.normalize_export_v12_record(
  _collection text,
  _record jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb := tasks_private.normalize_export_v12_record_start_dependent(
    _collection, _record, _planning_date
  );
  _start_date date;
  _horizon text;
  _primary_link text;
BEGIN
  IF _collection IN ('tasks_todos', 'tasks_projects') THEN
    _start_date := NULLIF(_normalized ->> 'start_date', '')::date;
    _horizon := _normalized ->> 'today_section';
    IF _normalized ->> 'destination' = 'someday' THEN
      _start_date := NULL;
      _horizon := NULL;
    ELSIF _start_date IS NOT NULL AND _start_date <= _planning_date THEN
      _start_date := NULL;
      _horizon := 'inbox';
    ELSIF _start_date IS NOT NULL THEN
      _horizon := NULL;
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'start_date', to_jsonb(_start_date),
      'today_section', to_jsonb(_horizon)
    );
  END IF;
  IF _collection = 'tasks_todos' THEN
    IF _record ? 'primary_link' THEN
      _primary_link := NULLIF(btrim(_record ->> 'primary_link'), '');
    ELSIF (
      _normalized ->> 'source_url' LIKE 'message://%'
      OR _normalized ->> 'source_url' LIKE 'http://%'
      OR _normalized ->> 'source_url' LIKE 'https://%'
    ) THEN
      _primary_link := _normalized ->> 'source_url';
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'primary_link',
      to_jsonb(_primary_link)
    );
  ELSIF _collection = 'tasks_user_settings' THEN
    IF _record ? 'automatic_list_sorting'
      AND jsonb_typeof(_record -> 'automatic_list_sorting') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Task automatic list sorting preference must be boolean'
        USING ERRCODE = '22023';
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'automatic_list_sorting',
      COALESCE((_record ->> 'automatic_list_sorting')::boolean, false)
    );
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date)
FROM PUBLIC, anon, authenticated;
